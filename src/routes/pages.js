'use strict';

const pages = require('../pages');

// Handles /api/spaces/:spaceId/pages and /api/spaces/:spaceId/pages/:slug.
// Returns null when the request doesn't match this route's shape, so server.js can
// try the next route handler.
async function handlePagesRoute(req, res, url) {
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
