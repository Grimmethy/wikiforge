'use strict';

const http = require('http');
const path = require('path');
const { handleSpacesRoute } = require('./routes/spaces');
const { handlePagesRoute } = require('./routes/pages');
const { handleTemplatesRoute } = require('./routes/templates');
const { makePublicRouteHandler } = require('./routes/public');
const { ShareTokenStore } = require('./share-tokens');
const { registerSpace } = require('./spaces');
const { GitMarkdownAdapter } = require('./storage/git-markdown-adapter');

// Registers WikiForge's real integrations named in the design brain dump
// (bd-1790485555882) and its 2026-09-27/2026-09-28 follow-ups: DELIBERATELY SEPARATE
// spaces, each guarded by its own env var so requiring this module (e.g. from tests)
// never touches real data unless asked.
//
// - 'secondbrain': the operator's own personal notes vault (Journal, Ideas, Projects,
//   Characters, ...). This was originally (wrongly) named 'agent-manager' -- a notes
//   vault is not "Agent Manager knowledge," it's the pipeline operator's own second
//   brain, which happens to contain a project among many.
// - 'agent-manager': REAL Agent Manager knowledge -- what's in the pipeline and how to
//   use it (concepts, pipeline stages, dashboard, plugin system, config), content
//   sourced from the separate wikiforge-agent-manager repo, not the vault above.
// - 'wikiforge': WikiForge's own design/API/integration knowledge, content sourced from
//   the separate wikiforge-wiki repo -- self-hosting its own documentation the same way
//   the 'agent-manager' space does for Agent Manager.
// - 'propertyforager': PropertyForager's RE-SFA coaching-call content, content sourced
//   from the separate propertyforager-wiki repo -- the first space fed by a real
//   automated content pipeline (content-pipeline/'s wiki_transcript_extract/
//   wiki_page_promote task sources) rather than hand-authored pages.
function registerDefaultSpaces() {
  const secondBrainRoot = process.env.WIKIFORGE_SECOND_BRAIN_ROOT;
  if (secondBrainRoot) {
    registerSpace('secondbrain', new GitMarkdownAdapter(secondBrainRoot), { name: 'SecondBrain' });
  }
  const amWikiRoot = process.env.WIKIFORGE_AM_WIKI_ROOT;
  if (amWikiRoot) {
    registerSpace('agent-manager', new GitMarkdownAdapter(amWikiRoot), { name: 'Agent Manager Wiki' });
  }
  const wikiforgeWikiRoot = process.env.WIKIFORGE_WIKIFORGE_ROOT;
  if (wikiforgeWikiRoot) {
    registerSpace('wikiforge', new GitMarkdownAdapter(wikiforgeWikiRoot), { name: 'WikiForge Wiki' });
  }
  const propertyForagerRoot = process.env.WIKIFORGE_PROPERTYFORAGER_ROOT;
  if (propertyForagerRoot) {
    registerSpace('propertyforager', new GitMarkdownAdapter(propertyForagerRoot), { name: 'PropertyForager Wiki' });
  }
}

function createServer({ shareTokensPath } = {}) {
  const shareTokenStore = new ShareTokenStore(shareTokensPath);
  const handlePublicRoute = makePublicRouteHandler(shareTokenStore);

  return http.createServer(async (req, res) => {
    // Dashboard integration note: the agent-manager dashboard's own plugin-tab
    // mechanism (docs/PLUGIN_API.md "Dashboard tab") does not yet support a tab for a
    // server-slotted plugin -- only a script-loaded one. So, like the PromptForge/
    // ScriptForge companions, WikiForge's dashboard tab fetches this server directly
    // from the browser, cross-origin from the dashboard's own :7420 -- CORS headers
    // are required for that, not optional decoration.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    const handlers = [handleSpacesRoute, handlePagesRoute, handleTemplatesRoute, handlePublicRoute];
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
  const port = process.env.WIKIFORGE_PORT || 7421;
  const shareTokensPath = path.join(__dirname, '..', 'share-tokens.json');
  createServer({ shareTokensPath }).listen(port, () => {
    console.log(`WikiForge listening on :${port}`);
  });
}

module.exports = { createServer, registerDefaultSpaces };
