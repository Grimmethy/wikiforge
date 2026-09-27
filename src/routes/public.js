'use strict';

const pages = require('../pages');
const { respondJson } = require('./pages');

// The real embed endpoint: a consuming project's frontend (e.g. PropertyForager's
// site) fetches this directly, no auth beyond the token itself, read-only. See
// share-tokens.js for why this replaces a widget/iframe.
function makePublicRouteHandler(shareTokenStore) {
  return async function handlePublicRoute(req, res, url) {
    const m = /^\/api\/public\/([^/]+)$/.exec(url.pathname);
    if (!m || req.method !== 'GET') return false;
    const token = m[1];
    const ref = shareTokenStore.resolve(token);
    if (!ref) {
      respondJson(res, 404, { error: 'invalid or revoked token' });
      return true;
    }
    const page = await pages.getPageWithBacklinks(ref.spaceId, ref.slug);
    if (!page) {
      respondJson(res, 404, { error: 'page no longer exists' });
      return true;
    }
    respondJson(res, 200, page);
    return true;
  };
}

module.exports = { makePublicRouteHandler };
