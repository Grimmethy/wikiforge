# WikiForge

A small, standalone, headless wiki/knowledge-base service meant to be reused across
multiple projects rather than bolted onto any one of them. It exists because none of the
surveyed self-hosted wiki/PKM tools (Outline, Wiki.js, Docmost, XWiki, BookStack, SiYuan,
Logseq, AppFlowy) are built to be *embedded into* an existing site the way a project like
PropertyForager needs, and because the content this first needs to surface -- the
agent-manager project's own SecondBrain vault -- is already plain markdown with
`[[wikilink]]`-style links in a git repo, a shape none of those tools read natively
without a migration.

Design principles borrowed deliberately from each of those tools (see the full research
in the agent-manager brain dump this was scoped from):

- **Spaces** (Docmost) -- one running service, each consuming project gets its own
  isolated space bound to its own storage adapter.
- **Pluggable storage adapters** (Wiki.js) -- the API layer never assumes where content
  physically lives. `src/storage/git-markdown-adapter.js` reads/writes the real
  SecondBrain vault directly with zero migration.
- **Scoped public share links** (Outline) -- `src/share-tokens.js` + `GET
  /api/public/:token` is the actual embedding mechanism: a consuming site's own
  frontend fetches this and renders it in its own components, no iframe.
- **Typed structured fields alongside markdown** (XWiki) -- a page's `fields` object,
  round-tripped through YAML-ish frontmatter.
- **Journal-as-entry-point** (Logseq) -- `src/journal.js` groups date-prefixed pages
  into a timeline, matching this project's own brain-dump/Concept-timeline convention.
- **Block-level backlinks** (SiYuan) -- deliberately deferred. v1 is page-level
  `[[wikilink]]` backlinks only (`src/backlinks.js`).

## Layout

```
src/
  server.js               real minimal HTTP server (Node's built-in http, no framework)
  spaces.js                space registry
  pages.js                 orchestration: adapter + backlink index
  backlinks.js             [[wikilink]] parsing + backlink index
  journal.js               date-prefixed page grouping
  share-tokens.js           Outline-style public read tokens
  storage/
    storage-adapter.js      the adapter contract every backend must satisfy
    git-markdown-adapter.js  real adapter: plain markdown files, git-aware if available
  routes/
    spaces.js, pages.js, public.js
test/                      real tests, no mocks of WikiForge's own code
docs/
  ADAPTER_API.md            how to write a new storage adapter
```

## Running

```bash
npm test                        # node --test test/*.test.js
scripts/start.sh                 # starts against the real SecondBrain vault, backgrounded
```

`scripts/start.sh` defaults `WIKIFORGE_SECOND_BRAIN_ROOT` to the real live vault
(`/media/wok/model-cache/SecondBrain`, matching agent-manager.env's own `SECOND_BRAIN_DIR`)
and `WIKIFORGE_PORT` to `7421`; override either as env vars before calling it. Running
`node src/server.js` directly (e.g. for tests, or `npm start`) leaves
`WIKIFORGE_SECOND_BRAIN_ROOT` unset by default, registering zero spaces -- nothing
touches the real vault unless explicitly pointed at it.

## API surface (v1)

- `GET /api/spaces` -- list registered spaces
- `GET /api/spaces/:spaceId/pages` -- list pages with backlinks attached
- `GET /api/spaces/:spaceId/pages/:slug` -- read one page with backlinks
- `PUT /api/spaces/:spaceId/pages/:slug` -- write a page (body: `{title, body, fields}`)
- `DELETE /api/spaces/:spaceId/pages/:slug` -- delete a page
- `GET /api/public/:token` -- the real embed endpoint, resolves a share token to a page

Not yet built (intentionally out of v1 scope): journal/search HTTP routes (the
functions exist in `src/journal.js` but aren't wired to a route yet), a
`POST /api/spaces/:spaceId/pages/:slug/share` route for issuing tokens over HTTP (the
`ShareTokenStore` API exists and is tested; only the route is missing), auth beyond the
share-token itself, and a second (non-git) storage adapter for a from-scratch space like
PropertyForager's.

## Dashboard integration

Registered as a real agent-manager plugin (`POST /api/plugins/add`, live in
`plugins.json`) with a manifest-driven dashboard tab (`ui/wikiforge-tab.js`,
`docs/PLUGIN_API.md` "Dashboard tab" in agent-manager) -- 📖 WikiForge shows up as a real
nav tab. agent-manager's plugin-tab mechanism doesn't yet support a tab for a
process-managed ("slotted") plugin, only a script-loaded one -- so, like the
PromptForge/ScriptForge companions, this server is started independently
(`scripts/start.sh`), not by agent-manager's own process manager. The tab fetches this
server directly, cross-origin from the dashboard's own port (`src/server.js`'s CORS
headers exist for exactly this) and renders the real response natively -- a journal
view grouped by the vault's own date-prefix convention, click-through to a page's real
body (via the dashboard's existing markdown renderer) and its real backlinks. No iframe:
this is the Outline-style embedding principle from the design brain dump, proven against
the dashboard's own real plugin-tab machinery, not a mock of it.

## Status

Scaffolded 2026-09-27 from the design in agent-manager brain-dump entry
`bd-1790485555882`. Core (adapters, backlinks, journal, share tokens, pages
orchestration, the HTTP server and its three route groups) is real and tested -- 29
passing tests, plus a real end-to-end smoke test of the server against a throwaway
fixture space. The dashboard integration above is real and live: verified the plugin
entry persisted to the real `plugins.json`, the tab script is served byte-identical to
the file on disk through agent-manager's real route, and the server (started via
`scripts/start.sh`) returns 1,356 real pages from the live SecondBrain vault. Not yet
done: a PropertyForager space/adapter, and confirming the tab renders correctly in an
actual browser (verified via the HTTP layer only, not a browser session).
