# Writing a storage adapter

A storage adapter is the only thing a Space knows about how its content is stored. It
must extend `StorageAdapter` (`src/storage/storage-adapter.js`) and implement all five
methods; `git-markdown-adapter.js` is the reference implementation.

## The five methods

- `listPages()` -> `Array<{slug, title, updatedAt}>` -- a lightweight index, no bodies.
- `readPage(slug)` -> `{slug, title, body, fields, updatedAt} | null` -- the full page,
  or `null` if it doesn't exist. Never throw for a missing page.
- `writePage(slug, {title, body, fields})` -> `void` -- create or overwrite.
- `deletePage(slug)` -> `void` -- a no-op if the page doesn't already exist.
- `listRevisions(slug)` -> `Array<{revisionId, at, summary}>` -- return `[]` if the
  backend has no revision history rather than fabricating one.

## Rules that keep an adapter swappable

1. **Never parse `[[wikilinks]]` yourself.** That's `src/backlinks.js`'s job, run once
   across a whole space by `src/pages.js`. An adapter only ever returns raw `body` text.
2. **`fields` is always a plain object, never `undefined`.** Return `{}` when a backend
   has no typed fields for a page (e.g. plain markdown with no frontmatter).
3. **Slugs are the adapter's own choice of stable id**, but must round-trip: whatever
   `listPages()` returns as a `slug`, `readPage()` must accept back.
4. **Don't assume git.** `git-markdown-adapter.js` checks `isInsideGitWorkTree` and
   degrades to plain file I/O with empty `listRevisions()` when it isn't -- a database-
   backed adapter (e.g. for a from-scratch space like a future PropertyForager one)
   would implement its own equivalent, most likely a real revisions table.

## Testing a new adapter

Follow `test/git-markdown-adapter.test.js`'s shape: build a real throwaway instance of
whatever the adapter's backend is (a temp git repo there; a temp sqlite file, a temp
Postgres schema, etc. for a new one) in a `beforeEach`/helper, exercise all five methods
for real, and clean up afterward. Never mock the backend itself -- the whole point of the
adapter contract is that it either really works against its real backend or it doesn't.
