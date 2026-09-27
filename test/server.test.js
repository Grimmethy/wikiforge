'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createServer } = require('../src/server');
const { registerSpace, _clearAllSpaces } = require('../src/spaces');
const { GitMarkdownAdapter } = require('../src/storage/git-markdown-adapter');

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiforge-server-test-'));
    fs.writeFileSync(path.join(dir, 'hello.md'), '# Hello\n\nlinks to [[World]]\n');
    _clearAllSpaces();
    registerSpace('demo', new GitMarkdownAdapter(dir));
    const server = createServer({ shareTokensPath: path.join(dir, 'tokens.json') });
    server.listen(0, async () => {
      const base = `http://localhost:${server.address().port}`;
      try {
        await fn(base);
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });
}

test('GET /healthz returns ok -- required for a dashboard-managed process health check', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/healthz`);
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
  });
});

test('every real response carries Access-Control-Allow-Origin -- the dashboard tab fetches cross-origin', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/spaces`);
    assert.equal(r.headers.get('access-control-allow-origin'), '*');
  });
});

test('OPTIONS preflight is answered with 204 and no body', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/spaces/demo/pages/hello`, { method: 'OPTIONS' });
    assert.equal(r.status, 204);
    assert.equal(await r.text(), '');
  });
});
