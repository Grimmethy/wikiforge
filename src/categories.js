'use strict';

// Groups pages into named categories -- the deterministic, auto-maintained answer to
// a hand-curated RS-wiki-style category grid. A hand-built hub page rots the moment an
// editor stops maintaining it; this index can't, because it's recomputed from the
// pages themselves on every call, never written once and left to drift.
//
// Category resolution order:
//   1. An explicit fields.category (XWiki-style typed field) -- an author's own call,
//      always wins.
//   2. The page's top-level path segment (e.g. "Journal/2026-09-26-x" -> "Journal").
//      Checked against the real SecondBrain vault: 1352/1356 real pages live under a
//      top-level folder (Journal, Ideas, Projects, Characters, References, Research,
//      Agent Manager Reports, Model Benchmarks, ...) -- this one rule alone turns a
//      single flat 1356-item list into ~11 real categories with zero authoring.
//   3. "Journal" for a date-prefixed slug with no folder (the vault's bare convention).
//   4. "Uncategorized" as the last resort.

const UNCATEGORIZED = 'Uncategorized';
const DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}/;

function categoryForPage(page) {
  const explicit = page.fields && typeof page.fields.category === 'string' && page.fields.category.trim();
  if (explicit) return explicit.trim();

  const slashIdx = page.slug.lastIndexOf('/');
  if (slashIdx > 0) return page.slug.slice(0, slashIdx).split('/')[0];

  if (DATE_PREFIX_RE.test(page.slug)) return 'Journal';
  return UNCATEGORIZED;
}

/**
 * @param {Array<{slug, title, fields, updatedAt}>} pages
 * @returns {Array<{category: string, pages: Array}>} sorted alphabetically, Uncategorized last
 */
function buildCategoryIndex(pages) {
  const byCategory = new Map();
  for (const page of pages) {
    const category = categoryForPage(page);
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(page);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  return Array.from(byCategory.entries())
    .sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    })
    .map(([category, categoryPages]) => ({ category, pages: categoryPages }));
}

module.exports = { buildCategoryIndex, categoryForPage, UNCATEGORIZED };
