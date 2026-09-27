'use strict';

// Page-level [[wikilink]] parsing and backlink index. Deliberately page-level, not
// block-level (SiYuan's finer-grained primitive is a real v2 idea, not a v1
// requirement -- see bd-1790485555882). Matches the plain [[Target]] / [[Target|Label]]
// syntax already used across the SecondBrain vault and this project's own memory files.

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

function slugify(target) {
  return target.trim().toLowerCase().replace(/\s+/g, '-');
}

/** @returns {string[]} the slugs this page's body links to, deduplicated, in first-seen order */
function extractOutgoingLinks(body) {
  const seen = new Set();
  const out = [];
  let m;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(body))) {
    const slug = slugify(m[1]);
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push(slug);
    }
  }
  return out;
}

/**
 * Builds a full backlink index from a list of pages.
 * @param {Array<{slug: string, body: string}>} pages
 * @returns {Map<string, string[]>} target slug -> array of source slugs linking to it
 */
function buildBacklinkIndex(pages) {
  const index = new Map();
  for (const page of pages) {
    for (const targetSlug of extractOutgoingLinks(page.body)) {
      if (!index.has(targetSlug)) index.set(targetSlug, []);
      const sources = index.get(targetSlug);
      if (!sources.includes(page.slug)) sources.push(page.slug);
    }
  }
  return index;
}

module.exports = { extractOutgoingLinks, buildBacklinkIndex, slugify };
