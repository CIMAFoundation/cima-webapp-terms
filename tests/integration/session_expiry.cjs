// Run: node tests/integration/session_expiry.cjs
// Exercise the real interceptor and AuthService against deterministic HTTP failures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const frontendRequire = createRequire(path.resolve(__dirname, '../../frontend/package.json'));
const ts = frontendRequire('typescript');
const rxjs = frontendRequire('rxjs');
const HttpClient = class {};
const Router = class {};
const storage = new Map();
let navigations = 0;
let logouts = 0;
const instances = new Map([
  [HttpClient, { post: () => { logouts++; return rxjs.of({}); } }],
  [Router, { navigate: async () => { navigations++; } }]
]);
const modules = {
  '@angular/common/http': { HttpClient },
  '@angular/core': { Injectable: () => (value) => value, inject: (type) => instances.get(type) },
  '@angular/router': { Router },
  rxjs
};

/** Loads the actual TypeScript source while replacing Angular DI with fixture instances. */
function load(file) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/app/services', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true
  } }).outputText;
  const context = { exports: {}, localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  }, require: (name) => { assert.ok(modules[name], name); return modules[name]; } };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

/** Verifies that only a protected API 401 ends the browser session and requests login. */
async function verifySessionExpiry() {
  const { AuthService } = load('auth.service.ts');
  const auth = new AuthService();
  instances.set(AuthService, auth);
  modules['./auth.service'] = { AuthService };
  const { sessionInterceptor } = load('session.interceptor.ts');
  for (const [url, status, shouldExpire] of [
    ['api/documents.php', 401, true],
    ['api/upload.php', 401, true],
    ['api/documents.php', 403, false],
    ['api/login.php', 401, false],
    ['api/logout.php', 401, false],
    ['https://example.org/api/documents.php', 401, false]
  ]) {
    auth.setSession('fixture', { username: 'fixture', role: 'admin' });
    navigations = 0;
    let requests = 0;
    const error = { status };
    const result = sessionInterceptor({ url }, () => {
      requests++;
      return rxjs.throwError(() => error);
    });
    await assert.rejects(rxjs.firstValueFrom(result), (value) => value === error);
    assert.equal(auth.isAuthenticated(), !shouldExpire, url);
    assert.equal(auth.getUserRole(), shouldExpire ? '' : 'admin', url);
    assert.equal(navigations, shouldExpire ? 1 : 0, url);
    assert.equal(requests, 1, 'Never retry an upload automatically');
  }
  assert.equal(logouts, 0, 'Expired sessions do not send a second failing request');
  console.log('OK: API 401 clears credentials; 403, login and external failures preserve them; no retries.');
}
verifySessionExpiry().catch((error) => { console.error(error); process.exitCode = 1; });
