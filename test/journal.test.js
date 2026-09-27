'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { dateForSlug, buildJournal } = require('../src/journal');

test('dateForSlug: matches the real vault convention (date-prefixed filename)', () => {
  assert.equal(dateForSlug('2026-09-26-adhoc-orient-skip-test-rejected'), '2026-09-26');
  assert.equal(dateForSlug('Journal/2026-09-12-01-plugin-restart-failure'), '2026-09-12');
});

test('dateForSlug: a non-dated slug is not a journal entry', () => {
  assert.equal(dateForSlug('agent-manager-advisory-dedup'), null);
});

test('buildJournal: groups by date, newest first, ignores non-dated pages', () => {
  const pages = [
    { slug: '2026-09-12-a' },
    { slug: '2026-09-26-b' },
    { slug: '2026-09-26-c' },
    { slug: 'not-dated' },
  ];
  const journal = buildJournal(pages);
  assert.deepEqual(journal.map((e) => e.date), ['2026-09-26', '2026-09-12']);
  assert.equal(journal[0].pages.length, 2);
  assert.equal(journal[1].pages.length, 1);
});
