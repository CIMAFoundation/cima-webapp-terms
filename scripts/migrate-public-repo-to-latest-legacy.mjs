import fs from 'node:fs';
import path from 'node:path';

const publicRepoRoot = '/Users/deda/WebstormProjects/cima-webapp-terms/cima-legal-public-docs';
const manifestPath = path.join(publicRepoRoot, 'legal-docs', 'manifests', 'latest.json');
const latestRoot = path.join(publicRepoRoot, 'latest');
const legacyRoot = path.join(publicRepoRoot, 'legacy');

const docTypeMap = {
  terms: 'terms-of-use',
  privacy: 'privacy-policy',
  cookie: 'cookie-policy'
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(src, dst) {
  if (!fs.existsSync(src)) return false;
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  return true;
}

function normalizePublicPath(url) {
  const text = String(url || '');
  const matchPages = text.match(/cimafoundation\.github\.io\/cima-legal-public-docs\/(.+)/);
  if (matchPages) return matchPages[1];
  const matchRaw = text.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)/);
  if (matchRaw) return matchRaw[1];
  return '';
}

function buildIndexRows() {
  const rows = [];
  if (!fs.existsSync(manifestPath)) return rows;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const latest = manifest?.latest || {};
  for (const platform of Object.keys(latest)) {
    for (const docType of Object.keys(latest[platform] || {})) {
      for (const lang of Object.keys(latest[platform][docType] || {})) {
        const entry = latest[platform][docType][lang];
        if (!entry || entry.deletedAt) continue;
        const mappedDocType = docTypeMap[docType] || docType;
        const lineRaw = String(entry.line || '').trim();
        const line = lineRaw && lineRaw !== '-' ? lineRaw : platform;
        const sourceRel = normalizePublicPath(entry.downloadUrl || entry.url);
        const sourceAbs = sourceRel ? path.join(publicRepoRoot, sourceRel) : '';
        const effectiveDate = String(entry.effectiveDate || new Date().toISOString().slice(0, 10));
        const latestRel = path.join('latest', line, lang, `${mappedDocType}.pdf`);
        const legacyRel = path.join('legacy', line, lang, `${mappedDocType}_${effectiveDate}.pdf`);
        const latestAbs = path.join(publicRepoRoot, latestRel);
        const legacyAbs = path.join(publicRepoRoot, legacyRel);

        if (sourceAbs && fs.existsSync(sourceAbs)) {
          copyIfExists(sourceAbs, latestAbs);
          copyIfExists(sourceAbs, legacyAbs);
        }

        rows.push({
          id: `${line}-${lang}-${mappedDocType}`,
          line,
          lang,
          docType: mappedDocType,
          effectiveDate,
          publicUrl: `https://cimafoundation.github.io/cima-legal-public-docs/${latestRel.replace(/\\/g, '/')}`,
          downloadFileName: `${mappedDocType}.pdf`
        });
      }
    }
  }
  return rows.sort((a, b) => {
    const lineCmp = a.line.localeCompare(b.line);
    if (lineCmp !== 0) return lineCmp;
    const langCmp = a.lang.localeCompare(b.lang);
    if (langCmp !== 0) return langCmp;
    return a.docType.localeCompare(b.docType);
  });
}

function writeIndex(rows) {
  const out = path.join(publicRepoRoot, 'assets', 'latest-index.json');
  fs.writeFileSync(out, `${JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2)}\n`);
}

ensureDir(latestRoot);
ensureDir(legacyRoot);
const rows = buildIndexRows();
writeIndex(rows);
console.log(`Migrated docs. rows=${rows.length}`);
