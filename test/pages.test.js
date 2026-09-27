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
