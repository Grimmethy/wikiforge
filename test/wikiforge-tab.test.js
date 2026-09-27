'use strict';

// ui/wikiforge-tab.js is a browser script: it references escapeHtml/escapeAttr/
// fetchJson/renderReportMarkdown/registerPluginTabRenderer as globals defined by other
// <script> tags in agent-manager's index.html (same convention as agent-manager's own
// concepts-and-adhoc-tab.test.js). Stub them before require() so this Node process's
// single global scope doesn't throw a ReferenceError -- real behavior of those
// functions is not under test here, only wikiforge-tab.js's own pure helpers.

global.escapeHtml = (s) => String(s == null ? '' : s);
global.escapeAttr = (s) => String(s == null ? '' : s);
global.fetchJson = async () => { throw new Error('not stubbed for this test'); };
global.renderReportMarkdown = (s) => String(s == null ? '' : s);
global.registerPluginTabRenderer = () => {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { groupIntoCategories, wikiforgeCategoryFor, wikiforgeDateFor, wikiforgeSlugify } = require('../ui/wikiforge-tab.js');

test('wikiforgeCategoryFor: mirrors src/categories.js exactly -- explicit field wins', () => {
  assert.equal(wikiforgeCategoryFor({ slug: 'x', fields: { category: 'Special' } }), 'Special');
});

test('wikiforgeCategoryFor: falls back to the top-level folder', () => {
  assert.equal(wikiforgeCategoryFor({ slug: 'Projects/a', fields: {} }), 'Projects');
});

test('wikiforgeCategoryFor: bare date-prefixed slug is Journal', () => {
  assert.equal(wikiforgeCategoryFor({ slug: '2026-09-26-x', fields: {} }), 'Journal');
});

test('wikiforgeCategoryFor: no signal at all is Uncategorized', () => {
  assert.equal(wikiforgeCategoryFor({ slug: 'note', fields: {} }), 'Uncategorized');
});

test('wikiforgeDateFor: extracts the date from a nested or bare slug', () => {
  assert.equal(wikiforgeDateFor('Journal/2026-09-26-x'), '2026-09-26');
  assert.equal(wikiforgeDateFor('2026-09-26-x'), '2026-09-26');
  assert.equal(wikiforgeDateFor('no-date-here'), null);
});

test('groupIntoCategories: groups and sorts, Uncategorized always last', () => {
  const pages = [
    { slug: 'Projects/a', fields: {} },
    { slug: 'Ideas/b', fields: {} },
    { slug: 'no-signal', fields: {} },
  ];
  const grouped = groupIntoCategories(pages);
  assert.deepEqual(grouped.map((g) => g.category), ['Ideas', 'Projects', 'Uncategorized']);
});

test('wikiforgeSlugify: matches the vault-friendly slug shape (lowercase, hyphenated, trimmed)', () => {
  assert.equal(wikiforgeSlugify('  My New Guide!! '), 'my-new-guide');
  assert.equal(wikiforgeSlugify('Already-slug-like'), 'already-slug-like');
});
