'use strict';

const { listTemplates } = require('../templates');
const { respondJson } = require('./pages');

// GET /api/templates -- the list a "New page" UI picks from.
async function handleTemplatesRoute(req, res, url) {
  if (url.pathname !== '/api/templates' || req.method !== 'GET') return false;
  respondJson(res, 200, listTemplates());
  return true;
}

module.exports = { handleTemplatesRoute };
