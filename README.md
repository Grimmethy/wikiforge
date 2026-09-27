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
- **Category grid + guide index** (RuneScape Wiki), but AI/human-templated instead of
  volunteer-maintained -- `src/categories.js` groups pages deterministically (an
  explicit `fields.category`, else the top-level folder, else "Journal"/"Uncategorized"),
  so the navigational index can't rot the way a hand-built hub page does. Real content
  pages (guides, references, category indexes) are authored via `src/templates.js`
  instead, a starting skeleton rather than a from-scratch community process.
- **A fixed-slug home page** (`pages.js`'s `getHomePage`, the `home` template) -- a
  space's own front page, the RS-wiki-front-page pattern without needing a wiki-scale
  editor base to keep it current.

## Layout

```
src/
  server.js               real minimal HTTP server (Node's built-in http, no framework)
  spaces.js                space registry
  pages.js                 orchestration: adapter + backlinks + categories + templates
  backlinks.js             [[wikilink]] parsing + backlink index
  journal.js               date-prefixed page grouping
  categories.js             deterministic category grouping (RS-wiki-grid, but auto-maintained)
  templates.js              named page-creation templates (guide/reference/category-index/home)
  share-tokens.js           Outline-style public read tokens
  storage/
    storage-adapter.js      the adapter contract every backend must satisfy
    git-markdown-adapter.js  real adapter: plain markdown files, git-aware if available
  routes/
    spaces.js, pages.js, templates.js, public.js
ui/
  secondbrain-tab.js         native dashboard tab for the 'secondbrain' space
  agent-manager-wiki-tab.js  native dashboard tab for the 'agent-manager' space (sibling
                             file, not a shared import -- see its own header comment)
test/                      real tests, no mocks of WikiForge's own code
docs/
  ADAPTER_API.md            how to write a new storage adapter
```

## Running

```bash
npm test                        # node --test test/*.test.js
scripts/start.sh                 # starts against the real SecondBrain vault, backgrounded
```

`scripts/start.sh` registers two real spaces by default:

- `secondbrain`, from `WIKIFORGE_SECOND_BRAIN_ROOT` (default
  `/media/wok/model-cache/SecondBrain`, matching agent-manager.env's own
  `SECOND_BRAIN_DIR`) -- the operator's personal notes vault.
- `agent-manager`, from `WIKIFORGE_AM_WIKI_ROOT` (default
  `/media/wok/model-cache/wikiforge-agent-manager`, a clone of the separate
  [wikiforge-agent-manager](https://github.com/Grimmethy/wikiforge-agent-manager) repo)
  -- real knowledge about Agent Manager's own functioning.

These are deliberately separate spaces and separate dashboard tabs (📓 SecondBrain,
📖 Agent Manager Wiki) -- a personal notes vault and a project's own reference material
answer different questions, and treating them as one space (WikiForge's original
mistake) made that impossible to navigate. `WIKIFORGE_PORT` defaults to `7421`; override
any of the three as env vars before calling `scripts/start.sh`. Running `node
src/server.js` directly (e.g. for tests, or `npm start`) leaves both root env vars
unset by default, registering zero spaces -- nothing touches real data unless
explicitly pointed at it.

## API surface (v1)

- `GET /api/spaces` -- list registered spaces
- `GET /api/spaces/:spaceId/pages` -- list pages with backlinks attached
- `GET /api/spaces/:spaceId/pages/:slug` -- read one page with backlinks
- `PUT /api/spaces/:spaceId/pages/:slug` -- write a page (body: `{title, body, fields}`),
  or create one from a template (body: `{templateId, title}`, no `body` field -- 409 if
  the slug already exists, so a template can never silently clobber real content)
- `DELETE /api/spaces/:spaceId/pages/:slug` -- delete a page
- `GET /api/spaces/:spaceId/categories` -- pages grouped by category (`src/categories.js`)
- `GET /api/spaces/:spaceId/home` -- the space's fixed-slug (`home`) landing page, 404
  if it hasn't been created yet
- `GET /api/templates` -- the built-in templates (`guide`, `reference`,
  `category-index`, `home`), for a "New page" picker
- `GET /api/public/:token` -- the real embed endpoint, resolves a share token to a page

Not yet built (intentionally out of v1 scope): a journal HTTP route (the function
exists in `src/journal.js` but isn't wired to a route yet -- the dashboard tab currently
gets its date-grouping for the "Journal" category client-side instead), full-text
search, a `POST /api/spaces/:spaceId/pages/:slug/share` route for issuing tokens over
HTTP (the `ShareTokenStore` API exists and is tested; only the route is missing), auth
beyond the share-token itself, and a second (non-git) storage adapter for a from-scratch
space like PropertyForager's.

## Dashboard integration

Registered as two real agent-manager plugins (hand-edited into `plugins.json` per
`docs/PLUGIN_API.md`'s explicit "by hand, or via `POST /api/plugins/add`") with
manifest-driven dashboard tabs -- 📓 SecondBrain (`wikiforge-secondbrain`,
`ui/secondbrain-tab.js`) and 📖 Agent Manager Wiki (`wikiforge-agent-manager`,
`ui/agent-manager-wiki-tab.js`) both show up as real nav tabs. Two entries because
agent-manager's plugin-tab mechanism validates one `registerPath` per plugin name, so
each tab gets its own trivial no-op file (`register.js`, `register-am-wiki.js`) even
though both resolve to this same repo's shared `ui/` directory. agent-manager's
plugin-tab mechanism also doesn't yet support a tab for a process-managed ("slotted")
plugin, only a script-loaded one -- so, like the PromptForge/ScriptForge companions,
this server is started independently (`scripts/start.sh`), not by agent-manager's own
process manager.

Each tab fetches this server directly, cross-origin from the dashboard's own port
(`src/server.js`'s CORS headers exist for exactly this) and renders the real response
natively -- a **collapsible-by-category sidebar** (native `<details>`, one per category,
expanded state preserved across the dashboard's 5s poll re-renders), a **Home** link,
and a **"+ New page"** form backed by `/api/templates`. Click-through shows a page's
real body (via the dashboard's existing markdown renderer) and its real backlinks. No
iframe: this is the Outline-style embedding principle from the design brain dump,
proven against the dashboard's own real plugin-tab machinery, not a mock of it.

The two tab files are near-identical (same categories/templates/home logic, different
`WIKIFORGE_SPACE_ID`) but kept as separate self-contained files rather than one shared
module, wrapped in an IIFE each -- a plugin tab's script loads lazily as a plain classic
`<script>` only when its tab is first visited, and classic `<script>` tags share one
global scope, so two files declaring the same top-level `let` would be a real
`SyntaxError` if a user visits both tabs in one session without the IIFE wrapper.

## Status

Scaffolded 2026-09-27 from the design in agent-manager brain-dump entry
`bd-1790485555882`; extended the same day with categories/templates/home after review
against the RuneScape Wiki's front page (borrowed: category grid, guide index, a fixed
front page -- deliberately *not* borrowed: requiring a volunteer-editor community to
keep a hand-built hub page from rotting; a template + deterministic category index does
that job here instead); split into two spaces/tabs the same day after recognizing the
original single `agent-manager` space (pointed at the SecondBrain vault) was a naming
mistake, not a scope decision -- real Agent Manager knowledge now lives in its own
public content repo, [wikiforge-agent-manager](https://github.com/Grimmethy/wikiforge-agent-manager).

Core (adapters, backlinks, journal, categories, templates, share tokens, pages
orchestration, the HTTP server and its five route groups) is real and tested -- 68
passing tests. The dashboard integration is real and live: both tab scripts are served
byte-identical to the files on disk through agent-manager's real route, and the server
(started via `scripts/start.sh`) returns distinct, correctly-scoped real data for each
space -- 1,357 SecondBrain pages, and the seeded Agent Manager Wiki content. Not yet
done: the PropertyForager space/adapter (its content repo,
[propertyforager-wiki](https://github.com/Grimmethy/propertyforager-wiki), exists but is
an empty placeholder -- no content design pass has happened yet), and confirming either
tab renders correctly in an actual browser (verified via the HTTP layer only, not a
browser session).
