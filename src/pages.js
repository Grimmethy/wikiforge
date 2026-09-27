'use strict';

// Thin orchestration layer: combines a space's storage adapter with the backlink
// index. This is the seam the HTTP routes (routes/pages.js) and any future
// journal/search feature should call through -- neither should talk to a storage
// adapter or to backlinks.js directly.

const { getSpace } = require('./spaces');
const { buildBacklinkIndex } = require('./backlinks');

async function listPagesWithBacklinks(spaceId) {
  const { adapter } = getSpace(spaceId);
  const summaries = await adapter.listPages();
  const full = await Promise.all(summaries.map((s) => adapter.readPage(s.slug)));
  const index = buildBacklinkIndex(full.filter(Boolean));
  return full.filter(Boolean).map((page) => ({
    ...page,
    backlinks: index.get(page.slug) || [],
  }));
}

async function getPageWithBacklinks(spaceId, slug) {
  const { adapter } = getSpace(spaceId);
  const page = await adapter.readPage(slug);
  if (!page) return null;
  const summaries = await adapter.listPages();
  const others = await Promise.all(summaries.map((s) => adapter.readPage(s.slug)));
  const index = buildBacklinkIndex(others.filter(Boolean));
  return { ...page, backlinks: index.get(slug) || [] };
}

async function writePage(spaceId, slug, page) {
  const { adapter } = getSpace(spaceId);
  return adapter.writePage(slug, page);
}

async function deletePage(spaceId, slug) {
  const { adapter } = getSpace(spaceId);
  return adapter.deletePage(slug);
}

module.exports = { listPagesWithBacklinks, getPageWithBacklinks, writePage, deletePage };
