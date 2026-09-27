'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCategoryIndex, categoryForPage, UNCATEGORIZED } = require('../src/categories');

test('categoryForPage: an explicit fields.category always wins', () => {
  const page = { slug: 'Journal/2026-09-26-x', fields: { category: 'Special' } };
  assert.equal(categoryForPage(page), 'Special');
});

test('categoryForPage: falls back to the top-level path segment', () => {
  assert.equal(categoryForPage({ slug: 'Projects/wikiforge-status', fields: {} }), 'Projects');
  assert.equal(categoryForPage({ slug: 'Agent Manager Reports/x/y', fields: {} }), 'Agent Manager Reports');
});

test('categoryForPage: a bare date-prefixed slug with no folder is "Journal"', () => {
  assert.equal(categoryForPage({ slug: '2026-09-26-some-entry', fields: {} }), 'Journal');
});

test('categoryForPage: no folder, no date, no explicit category -> Uncategorized', () => {
  assert.equal(categoryForPage({ slug: 'random-note', fields: {} }), UNCATEGORIZED);
});

test('categoryForPage: missing fields object entirely does not throw', () => {
  assert.equal(categoryForPage({ slug: 'random-note' }), UNCATEGORIZED);
});

test('buildCategoryIndex: groups correctly and sorts categories alphabetically, Uncategorized last', () => {
  const pages = [
    { slug: 'Projects/a', fields: {}, updatedAt: '2026-01-01' },
    { slug: 'Ideas/b', fields: {}, updatedAt: '2026-01-02' },
    { slug: 'no-folder', fields: {}, updatedAt: '2026-01-03' },
  ];
  const index = buildCategoryIndex(pages);
  assert.deepEqual(index.map((e) => e.category), ['Ideas', 'Projects', UNCATEGORIZED]);
});

test('buildCategoryIndex: pages within a category are sorted newest-first', () => {
  const pages = [
    { slug: 'Ideas/old', fields: {}, updatedAt: '2026-01-01' },
    { slug: 'Ideas/new', fields: {}, updatedAt: '2026-06-01' },
  ];
  const index = buildCategoryIndex(pages);
  assert.deepEqual(index[0].pages.map((p) => p.slug), ['Ideas/new', 'Ideas/old']);
});
