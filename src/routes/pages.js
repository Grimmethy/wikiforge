'use strict';

const pages = require('../pages');

// Handles /api/spaces/:spaceId/categories -- the deterministic, auto-maintained
// grouping (src/categories.js) the tab's collapsible sidebar renders from, instead of
// one flat page list.
async function handleCategoriesRoute(req, res, url) {
  const m = /^\/api\/spaces\/([^/]+)\/categories$/.exec(url.pathname);
  if (!m || req.method !== 'GET') return false;
  try {
    respondJson(res, 200, await pages.listPagesGroupedByCategory(m[1]));
  } catch (err) {
    respondJson(res, 500, { error: err.message });
  }
  return true;
}

// Handles /api/spaces/:spaceId/home -- the fixed-slug landing page (pages.js's
// getHomePage). 404 (not 500) when a space has no home page yet -- that's an expected,
// unremarkable state for a brand-new space, not an error.
async function handleHomeRoute(req, res, url) {
  const m = /^\/api\/spaces\/([^/]+)\/home$/.exec(url.pathname);
  if (!m || req.method !== 'GET') return false;
  try {
    const page = await pages.getHomePage(m[1]);
    if (!page) return respondJson(res, 404, { error: 'no home page yet' }), true;
    respondJson(res, 200, page);
  } catch (err) {
    respondJson(res, 500, { error: err.message });
  }
  return true;
}

// Handles /api/spaces/:spaceId/pages and /api/spaces/:spaceId/pages/:slug.
// Returns null when the request doesn't match this route's shape, so server.js can
// try the next route handler.
async function handlePagesRoute(req, res, url) {
  if (await handleCategoriesRoute(req, res, url)) return true;
  if (await handleHomeRoute(req, res, url)) return true;

  const m = /^\/api\/spaces\/([^/]+)\/pages(?:\/(.+))?$/.exec(url.pathname);
  if (!m) return false;
  const [, spaceId, rest] = m;
  const slug = rest ? decodeURIComponent(rest) : null;

  try {
    if (req.method === 'GET' && !slug) {
      const list = await pages.listPagesWithBacklinks(spaceId);
      respondJson(res, 200, list);
      return true;
    }
    if (req.method === 'GET' && slug) {
      const page = await pages.getPageWithBacklinks(spaceId, slug);
      if (!page) return respondJson(res, 404, { error: 'not found' }), true;
      respondJson(res, 200, page);
      return true;
    }
    if (req.method === 'PUT' && slug) {
      const body = await readJsonBody(req);
      // A "New page from template" request looks like {templateId, title} with no
      // body/fields of its own -- resolve it through the template instead of writing
      // an empty page. An explicit `body` field always means "write this verbatim",
      // even if a templateId is also present.
      if (body.templateId && body.body === undefined) {
        try {
          const created = await pages.createPageFromTemplate(spaceId, slug, body.templateId, { title: body.title });
          respondJson(res, 201, created);
        } catch (err) {
          const status = /already exists/.test(err.message) ? 409 : 400;
          respondJson(res, status, { error: err.message });
        }
        return true;
      }
      await pages.writePage(spaceId, slug, body);
      respondJson(res, 204, null);
      return true;
    }
    if (req.method === 'DELETE' && slug) {
      await pages.deletePage(spaceId, slug);
      respondJson(res, 204, null);
      return true;
    }
  } catch (err) {
    respondJson(res, 500, { error: err.message });
    return true;
  }
  return false;
}

function respondJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body == null ? '' : JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

module.exports = { handlePagesRoute, respondJson, readJsonBody };
