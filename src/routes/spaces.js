'use strict';

const { listSpaces } = require('../spaces');
const { respondJson } = require('./pages');

async function handleSpacesRoute(req, res, url) {
  if (url.pathname !== '/api/spaces' || req.method !== 'GET') return false;
  respondJson(res, 200, listSpaces());
  return true;
}

module.exports = { handleSpacesRoute };
