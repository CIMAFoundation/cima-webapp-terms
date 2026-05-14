import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.ADMIN_API_PORT || 8787);
const GITHUB_TOKEN = String(process.env.GITHUB_ADMIN_TOKEN || '').trim();
const GITHUB_OWNER = String(process.env.GITHUB_OWNER || 'CIMAFoundation').trim();
const GITHUB_REPO = String(process.env.GITHUB_REPO || 'cima-legal-public-docs').trim();
const GITHUB_BRANCH = String(process.env.GITHUB_BRANCH || 'main').trim();
const MANIFEST_PATH = String(process.env.MANIFEST_PATH || 'legal-docs/manifests/latest.json').trim();
const LATEST_INDEX_PATH = 'assets/latest-index.json';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  return raw ? JSON.parse(raw) : {};
}

function requireToken() {
  if (!GITHUB_TOKEN) {
    const error = new Error('GITHUB_ADMIN_TOKEN missing on server');
    error.statusCode = 500;
    throw error;
  }
}

function githubHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
}

function contentsUrl(path) {
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
}

async function fetchManifest() {
  requireToken();
  const url = `${contentsUrl(MANIFEST_PATH)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Manifest read failed (${response.status}): ${text}`);
  }
  const payload = await response.json();
  const content = Buffer.from(String(payload.content || '').replace(/\n/g, ''), 'base64').toString(
    'utf-8'
  );
  const manifest = JSON.parse(content || '{}');
  return { manifest: manifest?.latest ? manifest : { latest: {} }, sha: String(payload.sha || '') };
}

async function fetchLatestIndex() {
  requireToken();
  const url = `${contentsUrl(LATEST_INDEX_PATH)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const response = await fetch(url, { headers: githubHeaders() });
  if (response.status === 404) {
    return { generatedAt: new Date().toISOString(), rows: [] };
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Latest index read failed (${response.status}): ${text}`);
  }
  const payload = await response.json();
  const content = Buffer.from(String(payload.content || '').replace(/\n/g, ''), 'base64').toString('utf-8');
  const parsed = JSON.parse(content || '{}');
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  return {
    generatedAt: String(parsed?.generatedAt || new Date().toISOString()),
    rows
  };
}

async function upsertFile(path, contentBase64, message) {
  requireToken();
  const url = contentsUrl(path);

  let sha;
  const existing = await fetch(`${url}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    headers: githubHeaders()
  });
  if (existing.ok) {
    const payload = await existing.json();
    sha = payload.sha;
  } else if (existing.status !== 404) {
    const text = await existing.text();
    throw new Error(`File read failed (${existing.status}): ${text}`);
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders(),
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch: GITHUB_BRANCH,
      sha
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`File upsert failed (${response.status}): ${text}`);
  }
}

async function deleteFile(path, message) {
  requireToken();
  const url = contentsUrl(path);
  const existing = await fetch(`${url}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    headers: githubHeaders()
  });
  if (existing.status === 404) return;
  if (!existing.ok) {
    const text = await existing.text();
    throw new Error(`File read failed (${existing.status}): ${text}`);
  }
  const payload = await existing.json();
  const response = await fetch(url, {
    method: 'DELETE',
    headers: githubHeaders(),
    body: JSON.stringify({
      message,
      branch: GITHUB_BRANCH,
      sha: payload.sha
    })
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`File delete failed (${response.status}): ${text}`);
  }
}

function getEntryOrThrow(latest, platform, docType, lang) {
  const entry = latest?.[platform]?.[docType]?.[lang];
  if (!entry) {
    const error = new Error(`Document not found: ${platform}/${docType}/${lang}`);
    error.statusCode = 404;
    throw error;
  }
  return entry;
}

function decodePublicPath(downloadUrl) {
  const pagesMatch = String(downloadUrl || '').match(
    /cimafoundation\.github\.io\/cima-legal-public-docs\/(.+)/
  );
  if (pagesMatch) return pagesMatch[1];
  const rawMatch = String(downloadUrl || '').match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
  return rawMatch ? rawMatch[1] : '';
}

function cleanupLatest(latest, platform, docType) {
  if (!latest?.[platform]?.[docType] || Object.keys(latest[platform][docType]).length === 0) {
    delete latest?.[platform]?.[docType];
  }
  if (!latest?.[platform] || Object.keys(latest[platform]).length === 0) {
    delete latest?.[platform];
  }
}

async function saveManifest(latest, message) {
  const contentBase64 = Buffer.from(`${JSON.stringify({ latest }, null, 2)}\n`, 'utf-8').toString('base64');
  await upsertFile(MANIFEST_PATH, contentBase64, message);
}

async function saveLatestIndex(rows, message) {
  const normalized = [...rows].sort((a, b) => {
    const lineCmp = String(a.line || '').localeCompare(String(b.line || ''));
    if (lineCmp !== 0) return lineCmp;
    const langCmp = String(a.lang || '').localeCompare(String(b.lang || ''));
    if (langCmp !== 0) return langCmp;
    return String(a.docType || '').localeCompare(String(b.docType || ''));
  });
  const payload = {
    generatedAt: new Date().toISOString(),
    rows: normalized
  };
  const contentBase64 = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf-8').toString('base64');
  await upsertFile(LATEST_INDEX_PATH, contentBase64, message);
}

function parseLatestFilePath(filePath) {
  const normalized = String(filePath || '').replace(/^\/+/, '');
  const match = normalized.match(/^latest\/([^/]+)\/([^/]+)\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return {
    line: match[1],
    lang: match[2],
    docType: match[3]
  };
}

async function softDelete(body) {
  const platform = String(body.platform || '');
  const docType = String(body.docType || '');
  const lang = String(body.lang || '');
  const { manifest } = await fetchManifest();
  const latest = structuredClone(manifest.latest || {});
  const entry = getEntryOrThrow(latest, platform, docType, lang);
  latest[platform][docType][lang] = { ...entry, deletedAt: new Date().toISOString() };
  await saveManifest(latest, `docs: soft-delete ${platform}/${docType}/${lang}`);
}

async function softDeleteBatch(body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return;

  const { manifest } = await fetchManifest();
  const latest = structuredClone(manifest.latest || {});
  let changed = 0;

  for (const item of items) {
    const platform = String(item?.platform || '');
    const docType = String(item?.docType || '');
    const lang = String(item?.lang || '');
    if (!platform || !docType || !lang) continue;

    const entry = latest?.[platform]?.[docType]?.[lang];
    if (!entry) continue;
    latest[platform][docType][lang] = { ...entry, deletedAt: new Date().toISOString() };
    changed += 1;
  }

  if (!changed) return;
  await saveManifest(latest, `docs: soft-delete batch (${changed})`);
}

async function restoreDoc(body) {
  const platform = String(body.platform || '');
  const docType = String(body.docType || '');
  const lang = String(body.lang || '');
  const { manifest } = await fetchManifest();
  const latest = structuredClone(manifest.latest || {});
  const entry = getEntryOrThrow(latest, platform, docType, lang);
  const nextEntry = { ...entry };
  delete nextEntry.deletedAt;
  latest[platform][docType][lang] = nextEntry;
  await saveManifest(latest, `docs: restore ${platform}/${docType}/${lang}`);
}

async function hardDelete(body) {
  const platform = String(body.platform || '');
  const docType = String(body.docType || '');
  const lang = String(body.lang || '');
  const { manifest } = await fetchManifest();
  const latest = structuredClone(manifest.latest || {});
  const entry = getEntryOrThrow(latest, platform, docType, lang);
  const filePath = String(body.filePath || decodePublicPath(entry.downloadUrl || entry.url || '') || '');
  if (!filePath) {
    throw new Error(`File path missing for ${platform}/${docType}/${lang}`);
  }

  await deleteFile(filePath, `docs: hard-delete ${platform}/${docType}/${lang}`);

  const latestInfo = parseLatestFilePath(filePath);
  if (latestInfo) {
    const latestIndex = await fetchLatestIndex();
    const nextRows = (latestIndex.rows || []).filter(
      (row) =>
        !(
          String(row?.line || '') === latestInfo.line &&
          String(row?.lang || '') === latestInfo.lang &&
          String(row?.docType || '') === latestInfo.docType
        )
    );
    await saveLatestIndex(nextRows, `docs: latest-index remove ${latestInfo.line}/${latestInfo.lang}/${latestInfo.docType}`);
  }

  delete latest?.[platform]?.[docType]?.[lang];
  cleanupLatest(latest, platform, docType);
  await saveManifest(latest, `docs: hard-delete ${platform}/${docType}/${lang}`);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/health') {
      sendJson(res, 200, {
        ok: true,
        repo: `${GITHUB_OWNER}/${GITHUB_REPO}`,
        branch: GITHUB_BRANCH,
        manifestPath: MANIFEST_PATH,
        tokenConfigured: Boolean(GITHUB_TOKEN)
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/documents/soft-delete') {
      const body = await readBody(req);
      await softDelete(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/documents/soft-delete-batch') {
      const body = await readBody(req);
      await softDeleteBatch(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/documents/restore') {
      const body = await readBody(req);
      await restoreDoc(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/documents/hard-delete') {
      const body = await readBody(req);
      await hardDelete(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, Number(error?.statusCode || 500), {
      error: error?.message || 'Unexpected error'
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[admin-api] listening on http://127.0.0.1:${PORT}`);
});
