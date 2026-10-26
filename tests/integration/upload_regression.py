"""Exercise the PHP upload API against a local GitHub fixture, without publishing.

Run: python3 tests/integration/upload_regression.py
Requires PHP with cURL. No credentials or real GitHub access are used.
"""
import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROOT = Path(__file__).resolve().parents[2]


class GithubFixture(BaseHTTPRequestHandler):
    """Model GitHub blobs and count branch updates for the upload regression."""

    def log_message(self, *_args):
        """Keep test output free of request noise."""

    def respond(self, body):
        """Return a JSON fixture response."""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_GET(self):
        """Serve a withdrawn document and the Git branch base."""
        if '/contents/' in self.path:
            index = {'rows': [{'id': 'demo-it-terms-of-use', 'line': 'demo',
                              'lang': 'it', 'docType': 'terms-of-use',
                              'deletedAt': '2026-01-01'}]}
            self.respond({'content': base64.b64encode(json.dumps(index).encode()).decode()})
        elif '/git/ref/' in self.path:
            self.respond({'object': {'sha': 'base-commit'}})
        else:
            self.respond({'tree': {'sha': 'base-tree'}})

    def do_POST(self):
        """Store uploaded bytes and optionally return a corrupt blob receipt."""
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path.endswith('/git/blobs'):
            content = base64.b64decode(body['content'])
            sha = hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()
            self.server.blobs[sha] = content
            self.respond({'sha': 'corrupt' if self.server.corrupt else sha})
        elif self.path.endswith('/git/trees'):
            self.server.tree = body['tree']
            self.respond({'sha': 'new-tree'})
        else:
            self.respond({'sha': 'new-commit'})

    def do_PATCH(self):
        """Record publication of one atomic commit."""
        self.server.updates += 1
        self.respond({'ok': True})


class UploadRegression(unittest.TestCase):
    """Verify content integrity, JSON responses, and batch failure boundaries."""

    def setUp(self):
        """Copy API sources into isolation and redirect GitHub to a local fixture."""
        self.temp = tempfile.TemporaryDirectory(prefix='webterms-upload-')
        self.addCleanup(self.temp.cleanup)
        self.public = Path(self.temp.name)
        api = self.public / 'api'
        api.mkdir()
        for name in ('_bootstrap.php', 'upload.php'):
            shutil.copy(ROOT / 'frontend/public/api' / name, api / name)
        self.github = ThreadingHTTPServer(('127.0.0.1', 0), GithubFixture)
        self.github.blobs = {}
        self.github.tree = []
        self.github.updates = 0
        self.github.corrupt = False
        thread = threading.Thread(target=self.github.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.github.server_close)
        self.addCleanup(self.github.shutdown)
        source = (api / '_bootstrap.php').read_text()
        source = source.replace('https://api.github.com',
                                f'http://127.0.0.1:{self.github.server_port}')
        (api / '_bootstrap.php').write_text(source)
        (self.public / 'webterms.env.php').write_text("<?php return ['GITHUB_ADMIN_TOKEN'=>'fixture'];")
        # PHP chooses a free port; its startup log provides the actual address.
        self.php = subprocess.Popen(
            ['php', '-d', 'display_errors=1', '-d', 'error_reporting=-1',
             '-S', '127.0.0.1:0', '-t', str(self.public)],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        self.addCleanup(self.stop_php)
        line = self.php.stderr.readline()
        self.base = line.split('(http://', 1)[1].split(')', 1)[0]
        self.base = 'http://' + self.base

    def stop_php(self):
        """Stop the isolated PHP server and release its log pipe."""
        self.php.terminate()
        self.php.wait(timeout=5)
        self.php.stderr.close()

    def upload(self, items):
        """Post a batch and require a clean JSON response under PHP E_ALL."""
        request = urllib.request.Request(self.base + '/api/upload.php',
                                        data=json.dumps({'items': items}).encode(),
                                        headers={'Content-Type': 'application/json'})
        try:
            response = urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read())

    def item(self, lang='it'):
        """Create distinct PDF bytes for each language."""
        return {'line': 'demo', 'lang': lang, 'docType': 'terms-of-use',
                'date': '2026-10-26', 'fileName': f'new-{lang}.pdf',
                'contentBase64': base64.b64encode(b'%PDF-1.4\n' + lang.encode()).decode()}

    def test_batch_content_receipts_and_republication(self):
        """Publish both PDFs once, restore the withdrawn row, and verify all bytes."""
        items = [self.item(), self.item('en')]
        status, receipt = self.upload(items)
        self.assertEqual(status, 200)
        self.assertEqual(receipt['count'], 2)
        self.assertEqual(self.github.updates, 1)
        tree = {entry['path']: self.github.blobs[entry['sha']] for entry in self.github.tree}
        index = json.loads(tree['assets/latest-index.json'])
        self.assertEqual(len(index['rows']), 2)
        for item, doc in zip(items, receipt['documents']):
            content = base64.b64decode(item['contentBase64'])
            self.assertEqual(tree[doc['latestPath']], content)
            self.assertEqual(tree[doc['legacyPath']], content)
            self.assertEqual(doc['sha256'], hashlib.sha256(content).hexdigest())
            row = next(row for row in index['rows'] if row['lang'] == item['lang'])
            self.assertEqual(row['sha256'], doc['sha256'])
            self.assertEqual(row['originalFileName'], item['fileName'])
            self.assertNotIn('deletedAt', row)

    def test_corrupt_blob_never_updates_branch(self):
        """Reject a mismatched GitHub blob before creating a publication commit."""
        self.github.corrupt = True
        status, body = self.upload([self.item()])
        self.assertEqual(status, 502)
        self.assertIn('verification failed', body['error'])
        self.assertEqual(self.github.updates, 0)

    def test_duplicate_destination_never_writes(self):
        """Reject duplicate destinations before uploading any blob."""
        status, _body = self.upload([self.item(), self.item()])
        self.assertEqual(status, 400)
        self.assertEqual(self.github.blobs, {})
        self.assertEqual(self.github.updates, 0)


if __name__ == '__main__':
    unittest.main()
