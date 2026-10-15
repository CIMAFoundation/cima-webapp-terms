const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../frontend/dist/frontend/browser');
const row = { id: 'demo-it-terms-of-use', line: 'demo', lang: 'it', docType: 'terms-of-use',
  effectiveDate: '2026-01-01', publicUrl: 'https://example.org/latest/demo/it/terms-of-use.pdf' };
const removed = { ...row, id: 'demo-en-terms-of-use', lang: 'en', deletedAt: '2026-10-15',
  publicUrl: 'https://example.org/latest/demo/en/terms-of-use.pdf' };

// Serve the real Angular production build; only remote APIs use deterministic fixtures.
const server = http.createServer((request, response) => {
  const relative = new URL(request.url, 'http://localhost').pathname.replace(/^\/webterms\//, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) { response.writeHead(404).end(); return; }
  const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(root, 'index.html');
  const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html' };
  response.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  response.end(fs.readFileSync(target));
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/webterms/documents`;
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-gpu'] });
  try {
    for (const role of ['admin', 'dev', 'viewer']) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.addInitScript((role) => {
        localStorage.setItem('webterms_user', JSON.stringify({ username: 'test', role }));
        localStorage.setItem('webterms_token', 'test-csrf');
      }, role);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let protectedReads = 0;
      const writes = [];
      await page.route('**/infrastruttura/api/**', (route) => route.fulfill({ json: [] }));
      await page.route('**/assets/latest-index.json*', (route) => route.fulfill({ json: { rows: [row] } }));
      await page.route('**/api/documents.php', (route) => {
        protectedReads++;
        return route.fulfill({ json: { rows: [row, removed] } });
      });
      for (const endpoint of ['soft-delete-batch', 'restore']) {
        await page.route(`**/api/${endpoint}.php`, (route) => {
          assert.equal(route.request().headers()['x-webterms-csrf'], 'test-csrf');
          writes.push({ endpoint, body: route.request().postDataJSON() });
          return route.fulfill({ status: 202, json: { ok: true, status: 'queued' } });
        });
      }
      page.on('dialog', (dialog) => dialog.accept());
      await page.goto(url);
      await page.getByText('demo / terms / it', { exact: true }).waitFor();
      if (role === 'viewer') {
        assert.equal(await page.getByRole('button', { name: /Ritirati/ }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Ritira dalla pubblicazione' }).count(), 0);
        assert.equal(protectedReads, 0);
      } else {
        await page.locator('tbody input[type=checkbox]').first().check();
        await page.getByRole('button', { name: 'Ritira dalla pubblicazione' }).click();
        await page.getByText(/Ritiro di 1 documenti richiesto/).waitFor();
        assert.equal(writes[0].body.items.length, 1);
        await page.getByRole('button', { name: /Ritirati/ }).click();
        await page.getByText('Non pubblicato', { exact: true }).waitFor();
        assert.equal(await page.getByRole('link', { name: 'Scarica', exact: true }).count(), 0);
        assert.equal(await page.getByText(/Eliminazione Definitiva|Elimina Definitivamente/).count(), 0);
        if (role === 'admin') {
          await page.locator('main').screenshot({ path: '/tmp/terms-withdrawal-desktop.png', animations: 'disabled' });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.locator('main').screenshot({ path: '/tmp/terms-withdrawal-mobile.png', animations: 'disabled' });
          assert.equal(await page.locator('main').evaluate((element) => element.scrollWidth > element.clientWidth), false);
        }
        await page.locator('tbody input[type=checkbox]').first().check();
        await page.getByRole('button', { name: 'Ripristina Selezionati' }).click();
        await page.getByText(/Ripristino di 1 documenti richiesto/).waitFor();
        assert.equal(writes[1].endpoint, 'restore');
        assert.equal(writes[1].body.items.length, 1);
      }
      assert.deepEqual(errors, []);
      console.log(`${role}: browser OK`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
