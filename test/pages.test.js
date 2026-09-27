'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSpace, _clearAllSpaces } = require('../src/spaces');
const pages = require('../src/pages');
const { StorageAdapter } = require('../src/storage/storage-adapter');

// A minimal in-memory adapter, used only to test pages.js's orchestration
// (backlink-index attachment) in isolation from any real filesystem or git adapter.
class FakeAdapter extends StorageAdapter {
  constructor(initial = {}) {
    super();
    this.store = new Map(Object.entries(initial));
  }
  async listPages() {
    return Array.from(this.store.values()).map(({ slug, title, updatedAt }) => ({ slug, title, updatedAt }));
  }
  async readPage(slug) {
    return this.store.get(slug) || null;
  }
  async writePage(slug, page) {
    this.store.set(slug, { slug, title: page.title || slug, body: page.body, fields: page.fields || {}, updatedAt: new Date().toISOString() });
  }
  async deletePage(slug) {
    this.store.delete(slug);
  }
  async listRevisions() {
    return [];
  }
}

test.beforeEach(() => {
  _clearAllSpaces();
});

test('listPagesWithBacklinks: attaches real backlinks computed across the whole space', async () => {
  const adapter = new FakeAdapter({
    a: { slug: 'a', title: 'A', body: 'links to [[B]]', fields: {}, updatedAt: 'x' },
    b: { slug: 'b', title: 'B', body: 'no links', fields: {}, updatedAt: 'x' },
  });
  registerSpace('test-space', adapter);
  const list = await pages.listPagesWithBacklinks('test-space');
  const b = list.find((p) => p.slug === 'b');
  assert.deepEqual(b.backlinks, ['a']);
  const a = list.find((p) => p.slug === 'a');
  assert.deepEqual(a.backlinks, []);
});

test('getPageWithBacklinks: returns null for a missing page instead of throwing', async () => {
  registerSpace('test-space', new FakeAdapter({}));
  assert.equal(await pages.getPageWithBacklinks('test-space', 'nope'), null);
});

test('writePage then getPageWithBacklinks: round-trips through the real adapter call', async () => {
  registerSpace('test-space', new FakeAdapter({}));
  await pages.writePage('test-space', 'new-page', { title: 'New', body: 'hello', fields: {} });
  const page = await pages.getPageWithBacklinks('test-space', 'new-page');
  assert.equal(page.title, 'New');
  assert.equal(page.body, 'hello');
});

test('getPageWithBacklinks: throws a clear error for an unregistered space', async () => {
  await assert.rejects(() => pages.getPageWithBacklinks('no-such-space', 'x'), /no such space/);
});

test('createPageFromTemplate: writes a real page rendered from the named template', async () => {
  registerSpace('test-space', new FakeAdapter({}));
  const created = await pages.createPageFromTemplate('test-space', 'my-guide', 'guide', { title: 'My Guide' });
  assert.equal(created.title, 'My Guide');
  const page = await pages.getPageWithBacklinks('test-space', 'my-guide');
  assert.match(page.body, /^# My Guide/);
  assert.deepEqual(page.fields, { category: 'Guides', type: 'guide' });
});

test('createPageFromTemplate: refuses to overwrite an existing page', async () => {
  registerSpace('test-space', new FakeAdapter({ x: { slug: 'x', title: 'X', body: 'real content', fields: {}, updatedAt: 'y' } }));
  await assert.rejects(() => pages.createPageFromTemplate('test-space', 'x', 'guide', {}), /already exists/);
});

test('createPageFromTemplate: rejects an unknown template id', async () => {
  registerSpace('test-space', new FakeAdapter({}));
  await assert.rejects(() => pages.createPageFromTemplate('test-space', 'new', 'no-such-template', {}), /no such template/);
});

test('getHomePage: null when no page exists at slug "home"', async () => {
  registerSpace('test-space', new FakeAdapter({}));
  assert.equal(await pages.getHomePage('test-space'), null);
});

test('getHomePage: returns the real page at slug "home" with backlinks attached', async () => {
  registerSpace(
    'test-space',
    new FakeAdapter({ home: { slug: 'home', title: 'Home', body: 'welcome', fields: {}, updatedAt: 'x' } }),
  );
  const home = await pages.getHomePage('test-space');
  assert.equal(home.title, 'Home');
  assert.deepEqual(home.backlinks, []);
});

test('listPagesGroupedByCategory: real end-to-end grouping through the adapter + backlinks + categories', async () => {
  registerSpace(
    'test-space',
    new FakeAdapter({
      'Projects/a': { slug: 'Projects/a', title: 'A', body: 'text', fields: {}, updatedAt: '2026-01-01' },
      'Ideas/b': { slug: 'Ideas/b', title: 'B', body: 'text', fields: {}, updatedAt: '2026-01-02' },
    }),
  );
  const grouped = await pages.listPagesGroupedByCategory('test-space');
  assert.deepEqual(grouped.map((g) => g.category), ['Ideas', 'Projects']);
  assert.equal(grouped[0].pages[0].slug, 'Ideas/b');
});
