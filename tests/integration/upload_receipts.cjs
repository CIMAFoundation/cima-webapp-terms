// Run: node tests/integration/upload_receipts.cjs
// Exercise the actual service against fake HTTP receipts, without Angular or GitHub servers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createHash, webcrypto } = require('node:crypto');
const frontendRequire = createRequire(path.resolve(__dirname, '../../frontend/package.json'));
const ts = frontendRequire('typescript');
const source = fs.readFileSync(path.resolve(__dirname,
  '../../frontend/src/app/services/admin-api.service.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true
} }).outputText;

const HttpClient = class {};
const AuthService = class {};
const RuntimeConfigService = class {};
let receipt;
let cacheClears = 0;
let posts = 0;
const http = {
  post(url, body, options) {
    assert.equal(url, 'api/upload.php');
    assert.equal(options.headers['X-Webterms-CSRF'], 'fixture-csrf');
    assert.equal(body.items.length, 1);
    posts++;
    return receipt;
  }
};
const instances = new Map([
  [HttpClient, http],
  [AuthService, { getToken: () => 'fixture-csrf' }],
  [RuntimeConfigService, { clearCachedLatestIndex: () => cacheClears++ }]
]);
const modules = {
  '@angular/common/http': { HttpClient },
  '@angular/core': { Injectable: () => (value) => value, inject: (type) => instances.get(type) },
  rxjs: { firstValueFrom: async (value) => value },
  './auth.service': { AuthService },
  './runtime-config.service': { RuntimeConfigService }
};
const context = { exports: {}, require: (id) => {
  assert.ok(modules[id], `Unexpected dependency: ${id}`);
  return modules[id];
}, crypto: webcrypto, atob, Uint8Array };
vm.runInNewContext(compiled, context);
const service = new context.exports.AdminApiService();
const bytes = Buffer.from('%PDF-1.4\nnew-file');
const items = [{ line: 'demo', lang: 'it', docType: 'terms-of-use',
  date: '2026-10-26', fileName: 'new.pdf', contentBase64: bytes.toString('base64') }];
const doc = { latestPath: 'latest/demo/it/terms-of-use.pdf',
  sha256: createHash('sha256').update(bytes).digest('hex') };

/** Reject mismatched or incomplete receipts instead of marking the upload successful. */
async function verifyReceipts() {
  receipt = { count: 1, documents: [doc] };
  await service.uploadDocuments(items);
  assert.equal(cacheClears, 1);
  for (const invalid of [
    { count: 1, documents: [{ ...doc, sha256: 'wrong' }] },
    { count: 1, documents: [{ ...doc, latestPath: 'latest/wrong.pdf' }] },
    { count: 0, documents: [] },
    { count: 1 }
  ]) {
    receipt = invalid;
    await assert.rejects(() => service.uploadDocuments(items), /Controlla il repository/);
  }
  assert.equal(posts, 5);
  assert.equal(cacheClears, 5);
  console.log('OK: valid receipt, wrong hash, wrong path, missing documents, cache invalidation.');
}
verifyReceipts().catch((error) => { console.error(error); process.exitCode = 1; });
