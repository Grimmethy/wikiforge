'use strict';

// Logseq's journal-as-entry-point: notes file against dates by default, the graph
// organizes itself retroactively from backlinks. This project's own brain-dump-by-
// timestamp and Concept-timeline conventions already match this shape closely enough
// to adopt as the default landing view. A page counts as a journal entry if its slug
// (or the last path segment of its slug) starts with an ISO date, matching the real
// convention already used throughout the SecondBrain vault's Journal/ directory
// (e.g. "2026-09-26-adhoc-orient-skip-test-rejected").

const DATE_PREFIX_RE = /(?:^|\/)(\d{4}-\d{2}-\d{2})/;

/** @returns {string | null} the ISO date a page's slug encodes, or null if it isn't a journal entry */
function dateForSlug(slug) {
  const m = DATE_PREFIX_RE.exec(slug);
  return m ? m[1] : null;
}

/**
 * Groups pages into journal entries by date, newest first.
 * @param {Array<{slug: string}>} pages
 * @returns {Array<{date: string, pages: Array}>}
 */
function buildJournal(pages) {
  const byDate = new Map();
  for (const page of pages) {
    const date = dateForSlug(page.slug);
    if (!date) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(page);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, entries]) => ({ date, pages: entries }));
}

module.exports = { dateForSlug, buildJournal };
