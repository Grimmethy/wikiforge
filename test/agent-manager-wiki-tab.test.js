'use strict';

// ui/agent-manager-wiki-tab.js is secondbrain-tab.js's sibling (see that file's own
// header comment for why they're two separate files rather than one shared module).
// Same stubbing approach as test/secondbrain-tab.test.js.

global.escapeHtml = (s) => String(s == null ? '' : s);
global.escapeAttr = (s) => String(s == null ? '' : s);
global.fetchJson = async () => { throw new Error('not stubbed for this test'); };
global.renderReportMarkdown = (s) => String(s == null ? '' : s);
global.registerPluginTabRenderer = () => {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { groupIntoCategories, wikiforgeCategoryFor, wikiforgeDateFor, wikiforgeSlugify } = require('../ui/agent-manager-wiki-tab.js');

test('wikiforgeCategoryFor: mirrors src/categories.js exactly -- explicit field wins', () => {
  assert.equal(wikiforgeCategoryFor({ slug: 'x', fields: { category: 'Special' } }), 'Special');
});

test('wikiforgeCategoryFor: falls back to the top-level folder', () => {
  assert.equal(wikiforgeCategoryFor({ slug: 'Pipeline/a', fields: {} }), 'Pipeline');
});

test('wikiforgeCategoryFor: bare date-prefixed slug is Journal', () => {
  assert.equal(wikiforgeCategoryFor({ slug: '2026-09-26-x', fields: {} }), 'Journal');
});

test('wikiforgeCategoryFor: no signal at all is Uncategorized', () => {
  assert.equal(wikiforgeCategoryFor({ slug: 'note', fields: {} }), 'Uncategorized');
});

test('wikiforgeDateFor: extracts the date from a nested or bare slug', () => {
  assert.equal(wikiforgeDateFor('Journal/2026-09-26-x'), '2026-09-26');
  assert.equal(wikiforgeDateFor('no-date-here'), null);
});

test('groupIntoCategories: groups and sorts, Uncategorized always last', () => {
  const pages = [
    { slug: 'Pipeline/a', fields: {} },
    { slug: 'Concepts/b', fields: {} },
    { slug: 'no-signal', fields: {} },
  ];
  const grouped = groupIntoCategories(pages);
  assert.deepEqual(grouped.map((g) => g.category), ['Concepts', 'Pipeline', 'Uncategorized']);
});

test('wikiforgeSlugify: matches the vault-friendly slug shape (lowercase, hyphenated, trimmed)', () => {
  assert.equal(wikiforgeSlugify('  My New Guide!! '), 'my-new-guide');
});
