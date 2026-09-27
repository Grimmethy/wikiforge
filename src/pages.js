'use strict';

// Thin orchestration layer: combines a space's storage adapter with the backlink
// index. This is the seam the HTTP routes (routes/pages.js) and any future
// journal/search feature should call through -- neither should talk to a storage
// adapter or to backlinks.js directly.

const { getSpace } = require('./spaces');
const { buildBacklinkIndex } = require('./backlinks');
const { buildCategoryIndex } = require('./categories');
const { renderTemplate } = require('./templates');

const HOME_SLUG = 'home';

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

/**
 * Creates a new page from a named template (src/templates.js). Refuses to overwrite
 * an existing page -- a template is a starting point for something new, not a way to
 * silently clobber real content someone already wrote.
 */
async function createPageFromTemplate(spaceId, slug, templateId, { title } = {}) {
  const { adapter } = getSpace(spaceId);
  const existing = await adapter.readPage(slug);
  if (existing) throw new Error(`page "${slug}" already exists -- refusing to overwrite it from a template`);
  const rendered = renderTemplate(templateId, { title });
  if (!rendered) throw new Error(`no such template: ${templateId}`);
  await adapter.writePage(slug, rendered);
  return rendered;
}

/**
 * A space's designated landing page, at the fixed slug "home" -- nothing else in
 * WikiForge treats "home" specially; this is the one place that convention lives.
 * @returns {Promise<object | null>} null if the space has no home page yet
 */
async function getHomePage(spaceId) {
  return getPageWithBacklinks(spaceId, HOME_SLUG);
}

/** @returns {Promise<Array<{category: string, pages: Array}>>} */
async function listPagesGroupedByCategory(spaceId) {
  const pagesList = await listPagesWithBacklinks(spaceId);
  return buildCategoryIndex(pagesList);
}

module.exports = {
  listPagesWithBacklinks,
  getPageWithBacklinks,
  writePage,
  deletePage,
  createPageFromTemplate,
  getHomePage,
  listPagesGroupedByCategory,
  HOME_SLUG,
};
