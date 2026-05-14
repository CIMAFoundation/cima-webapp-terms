import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.ADMIN_API_PORT || 8787);
const GITHUB_TOKEN = String(process.env.GITHUB_ADMIN_TOKEN || '').trim();
const GITHUB_OWNER = String(process.env.GITHUB_OWNER || 'CIMAFoundation').trim();
const GITHUB_REPO = String(process.env.GITHUB_REPO || 'cima-legal-public-docs').trim();
const GITHUB_BRANCH = String(process.env.GITHUB_BRANCH || 'main').trim();
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

function normalizeUploadDocType(value) {
  const raw = String(value || '').trim();
  if (raw === 'terms-of-use' || raw === 'terms') return 'terms-of-use';
  if (raw === 'privacy-policy' || raw === 'privacy') return 'privacy-policy';
  if (raw === 'cookie-policy' || raw === 'cookie') return 'cookie-policy';
  return raw;
}

function normalizeCanonicalDocType(value) {
  const raw = String(value || '').trim();
  if (raw === 'terms-of-use' || raw === 'terms') return 'terms';
  if (raw === 'privacy-policy' || raw === 'privacy') return 'privacy';
  if (raw === 'cookie-policy' || raw === 'cookie') return 'cookie';
  return raw;
}

function toCanonicalRowDocType(rowDocType) {
  return normalizeCanonicalDocType(String(rowDocType || '').trim());
}

function findRowIndex(rows, criteria) {
  const line = String(criteria.line || '');
  const lang = String(criteria.lang || '');
  const canonicalDocType = normalizeCanonicalDocType(criteria.docType);
  return rows.findIndex(
    (row) =>
      String(row?.line || '') === line &&
      String(row?.lang || '') === lang &&
      toCanonicalRowDocType(row?.docType) === canonicalDocType
  );
}

function resolveRowCriteria(body) {
  const filePath = String(body.filePath || '').trim();
  const parsed = parseLatestFilePath(filePath);
  if (parsed) return parsed;
  return {
    line: String(body.platform || '').trim(),
    lang: String(body.lang || '').trim(),
    docType: String(body.docType || '').trim()
  };
}

async function uploadDoc(body) {
  const line = String(body.line || '').trim();
  const lang = String(body.lang || '').trim();
  const docType = normalizeUploadDocType(body.docType);
  const date = String(body.date || '').trim();
  const fileName = String(body.fileName || '').trim();
  const contentBase64 = String(body.contentBase64 || '').trim();

  if (!line || !lang || !docType || !date || !fileName || !contentBase64) {
    const err = new Error('Missing upload fields');
    err.statusCode = 400;
    throw err;
  }

  const latestPath = `latest/${line}/${lang}/${docType}.pdf`;
  const legacyPath = `legacy/${line}/${lang}/${docType}_${date}.pdf`;

  await upsertFile(latestPath, contentBase64, `docs: latest ${line}/${lang}/${docType}`);
  await upsertFile(legacyPath, contentBase64, `docs: legacy ${line}/${lang}/${docType}_${date}`);

  const latestIndex = await fetchLatestIndex();
  const nextRows = (latestIndex.rows || []).filter(
    (row) =>
      !(
        String(row?.line || '') === line &&
        String(row?.lang || '') === lang &&
        String(row?.docType || '') === docType
      )
  );
  nextRows.push({
    id: `${line}-${lang}-${docType}`,
    line,
    lang,
    docType,
    effectiveDate: date,
    publicUrl: `https://cimafoundation.github.io/cima-legal-public-docs/${latestPath}`,
    downloadFileName: `${docType}.pdf`
  });
  await saveLatestIndex(nextRows, `docs: update latest-index ${line}/${lang}/${docType}`);

  return { latestPath, legacyPath };
}

async function softDelete(body) {
  const rows = (await fetchLatestIndex()).rows || [];
  const criteria = resolveRowCriteria(body);
  const idx = findRowIndex(rows, criteria);
  if (idx < 0) {
    const error = new Error(
      `Document not found: ${criteria.line}/${normalizeCanonicalDocType(criteria.docType)}/${criteria.lang}`
    );
    error.statusCode = 404;
    throw error;
  }
  rows[idx] = { ...rows[idx], deletedAt: new Date().toISOString() };
  await saveLatestIndex(rows, `docs: soft-delete ${criteria.line}/${criteria.lang}/${rows[idx].docType}`);
}

async function softDeleteBatch(body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return;

  const rows = (await fetchLatestIndex()).rows || [];
  let changed = 0;

  for (const item of items) {
    const criteria = resolveRowCriteria(item || {});
    const idx = findRowIndex(rows, criteria);
    if (idx < 0) continue;
    rows[idx] = { ...rows[idx], deletedAt: new Date().toISOString() };
    changed += 1;
  }

  if (!changed) return;
  await saveLatestIndex(rows, `docs: soft-delete batch (${changed})`);
}

async function restoreDoc(body) {
  const rows = (await fetchLatestIndex()).rows || [];
  const criteria = resolveRowCriteria(body);
  const idx = findRowIndex(rows, criteria);
  if (idx < 0) {
    const error = new Error(
      `Document not found: ${criteria.line}/${normalizeCanonicalDocType(criteria.docType)}/${criteria.lang}`
    );
    error.statusCode = 404;
    throw error;
  }
  const next = { ...rows[idx] };
  delete next.deletedAt;
  rows[idx] = next;
  await saveLatestIndex(rows, `docs: restore ${criteria.line}/${criteria.lang}/${rows[idx].docType}`);
}

async function hardDelete(body) {
  const rows = (await fetchLatestIndex()).rows || [];
  const criteria = resolveRowCriteria(body);
  const idx = findRowIndex(rows, criteria);
  if (idx < 0) {
    const error = new Error(
      `Document not found: ${criteria.line}/${normalizeCanonicalDocType(criteria.docType)}/${criteria.lang}`
    );
    error.statusCode = 404;
    throw error;
  }

  const row = rows[idx];
  const filePath = String(
    body.filePath || `latest/${row.line}/${row.lang}/${row.docType}.pdf`
  ).trim();

  await deleteFile(
    filePath,
    `docs: hard-delete ${criteria.line}/${normalizeCanonicalDocType(criteria.docType)}/${criteria.lang}`
  );

  const nextRows = rows.filter((_, i) => i !== idx);
  await saveLatestIndex(nextRows, `docs: latest-index remove ${row.line}/${row.lang}/${row.docType}`);
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
        indexPath: LATEST_INDEX_PATH,
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

    if (req.method === 'POST' && url.pathname === '/api/admin/documents/upload') {
      const body = await readBody(req);
      const result = await uploadDoc(body);
      sendJson(res, 200, result);
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
