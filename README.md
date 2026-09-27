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
npm test                                    # node --test test/*.test.js
WIKIFORGE_SECOND_BRAIN_ROOT=/media/model-cache/github/SecondBrain npm start
```

Setting `WIKIFORGE_SECOND_BRAIN_ROOT` registers the first real integration -- an
`agent-manager` space, read-write against the actual vault, as its own adapter instance.
Leaving it unset starts the server with zero spaces registered (safe default; nothing
touches the real vault unless explicitly pointed at it).

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

## Status

Scaffolded 2026-09-27 from the design in agent-manager brain-dump entry
`bd-1790485555882`. Core (adapters, backlinks, journal, share tokens, pages
orchestration, the HTTP server and its three route groups) is real and tested -- 26
passing tests, plus a real end-to-end smoke test of the server against a throwaway
fixture space. Not yet done: wiring this into agent-manager's dashboard as a real
Concepts-tab consumer, and a PropertyForager space/integration.
