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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiforge-catshome-test-'));
    fs.mkdirSync(path.join(dir, 'Projects'));
    fs.writeFileSync(path.join(dir, 'Projects', 'a.md'), '# A\n\nsome real project note\n');
    fs.writeFileSync(path.join(dir, '2026-09-26-journal-entry.md'), '# Journal Entry\n\nbody\n');
    _clearAllSpaces();
    registerSpace('demo', new GitMarkdownAdapter(dir));
    const server = createServer({ shareTokensPath: path.join(dir, 'tokens.json') });
    server.listen(0, async () => {
      const base = `http://localhost:${server.address().port}`;
      try {
        await fn(base, dir);
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

test('GET /api/templates lists the real built-in templates', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/templates`);
    assert.equal(r.status, 200);
    const list = await r.json();
    assert.ok(list.some((t) => t.id === 'guide'));
    assert.ok(list.some((t) => t.id === 'home'));
  });
});

test('GET /api/spaces/:id/categories groups the real fixture pages by top-level folder', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/spaces/demo/categories`);
    assert.equal(r.status, 200);
    const grouped = await r.json();
    const projects = grouped.find((g) => g.category === 'Projects');
    assert.ok(projects, JSON.stringify(grouped));
    assert.equal(projects.pages[0].slug, 'Projects/a');
    const journal = grouped.find((g) => g.category === 'Journal');
    assert.ok(journal);
  });
});

test('GET /api/spaces/:id/home is 404 before a home page exists', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/spaces/demo/home`);
    assert.equal(r.status, 404);
  });
});

test('PUT with {templateId, title} creates a real page from a template, then GET /home finds it', async () => {
  await withServer(async (base) => {
    const put = await fetch(`${base}/api/spaces/demo/pages/home`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'home', title: 'Demo Space' }),
    });
    assert.equal(put.status, 201);
    const created = await put.json();
    assert.equal(created.title, 'Demo Space');

    const home = await fetch(`${base}/api/spaces/demo/home`);
    assert.equal(home.status, 200);
    const page = await home.json();
    assert.match(page.body, /^# Demo Space/);
  });
});

test('PUT with a templateId against an existing slug is refused with 409, does not overwrite', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/spaces/demo/pages/Projects/a`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'guide', title: 'Overwrite attempt' }),
    });
    assert.equal(r.status, 409);
    const page = await fetch(`${base}/api/spaces/demo/pages/Projects/a`).then((res) => res.json());
    assert.match(page.body, /some real project note/);
  });
});

test('PUT with an explicit body still writes verbatim even if templateId is also present', async () => {
  await withServer(async (base) => {
    const r = await fetch(`${base}/api/spaces/demo/pages/explicit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'guide', title: 'ignored', body: '# Explicit\n\nverbatim body', fields: {} }),
    });
    assert.equal(r.status, 204);
    const page = await fetch(`${base}/api/spaces/demo/pages/explicit`).then((res) => res.json());
    assert.match(page.body, /verbatim body/);
  });
});
