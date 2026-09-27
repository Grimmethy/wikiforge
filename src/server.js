'use strict';

const http = require('http');
const path = require('path');
const { handleSpacesRoute } = require('./routes/spaces');
const { handlePagesRoute } = require('./routes/pages');
const { makePublicRouteHandler } = require('./routes/public');
const { ShareTokenStore } = require('./share-tokens');
const { registerSpace } = require('./spaces');
const { GitMarkdownAdapter } = require('./storage/git-markdown-adapter');

// Registers the first real integration named in the design brain dump
// (bd-1790485555882): agent-manager's own space, read-only-in-practice today, backed
// directly by the real SecondBrain vault -- zero migration. Guarded by an env var so
// requiring this module (e.g. from tests) never touches the real vault unless asked.
function registerDefaultSpaces() {
  const secondBrainRoot = process.env.WIKIFORGE_SECOND_BRAIN_ROOT;
  if (secondBrainRoot) {
    registerSpace('agent-manager', new GitMarkdownAdapter(secondBrainRoot), { name: 'Agent Manager SecondBrain' });
  }
}

function createServer({ shareTokensPath } = {}) {
  const shareTokenStore = new ShareTokenStore(shareTokensPath);
  const handlePublicRoute = makePublicRouteHandler(shareTokenStore);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const handlers = [handleSpacesRoute, handlePagesRoute, handlePublicRoute];
    for (const handler of handlers) {
      // eslint-disable-next-line no-await-in-loop
      if (await handler(req, res, url)) return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'no such route' }));
  });
}

if (require.main === module) {
  registerDefaultSpaces();
  const port = process.env.PORT || 7421;
  const shareTokensPath = path.join(__dirname, '..', 'share-tokens.json');
  createServer({ shareTokensPath }).listen(port, () => {
    console.log(`WikiForge listening on :${port}`);
  });
}

module.exports = { createServer, registerDefaultSpaces };
