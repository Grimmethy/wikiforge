'use strict';

// The contract every storage adapter must satisfy. A Space is bound to exactly one
// adapter instance at registration time (see spaces.js) -- the rest of WikiForge
// (backlinks, journal, share tokens, the HTTP routes) only ever talks to a Space
// through these five methods and never assumes anything about where the bytes live.
// This is the Wiki.js-style pluggable-storage principle from the design brain dump
// (bd-1790485555882): agent-manager's space can read/write the real SecondBrain
// markdown+git vault directly (git-markdown-adapter.js) with zero migration, while a
// different project's space can use a plain-file or database-backed adapter from day
// one, without the API layer or any consuming frontend caring which.
//
// A page is always the same plain shape wherever it comes from:
//   { slug, title, body, fields, updatedAt }
// - slug: adapter-stable identifier (e.g. a relative path with the extension stripped)
// - title: display title, may differ from slug
// - body: raw markdown, including any [[wikilink]] syntax -- backlinks.js parses this
// - fields: a plain object of typed structured fields (XWiki-style), may be {}
// - updatedAt: ISO8601 string
//
// A revision is a lighter shape, used only by listRevisions:
//   { revisionId, at, summary }

class StorageAdapter {
  /** @returns {Promise<Array<{slug: string, title: string, updatedAt: string}>>} */
  async listPages() {
    throw new Error('listPages() not implemented');
  }

  /** @returns {Promise<{slug: string, title: string, body: string, fields: object, updatedAt: string} | null>} */
  async readPage(_slug) {
    throw new Error('readPage() not implemented');
  }

  /** @returns {Promise<void>} */
  async writePage(_slug, _page) {
    throw new Error('writePage() not implemented');
  }

  /** @returns {Promise<void>} */
  async deletePage(_slug) {
    throw new Error('deletePage() not implemented');
  }

  /** @returns {Promise<Array<{revisionId: string, at: string, summary: string}>>} */
  async listRevisions(_slug) {
    throw new Error('listRevisions() not implemented');
  }
}

module.exports = { StorageAdapter };
