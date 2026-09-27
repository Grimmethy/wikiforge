'use strict';

// Outline's real embedding mechanism: a scoped, read-only public link per page, not a
// widget or iframe. A consuming project's own frontend (e.g. PropertyForager's site)
// fetches GET /api/public/:token and renders the result in its own components -- this
// is the honest answer to "embed into an existing website" from the design brain dump.
//
// v1 storage: an in-memory map, persisted to a JSON file next to it so tokens survive
// a restart. No expiry yet (a real future need, not a v1 requirement) -- issuing a new
// token for the same page replaces the old one, which is enough revocation for now.

const fs = require('fs');
const crypto = require('crypto');

class ShareTokenStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.tokens = new Map();
    if (filePath && fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const [token, ref] of Object.entries(raw)) this.tokens.set(token, ref);
    }
  }

  _persist() {
    if (!this.filePath) return;
    const raw = Object.fromEntries(this.tokens.entries());
    fs.writeFileSync(this.filePath, JSON.stringify(raw, null, 2));
  }

  /** Issues (or replaces) a share token for one page. @returns {string} the token */
  issue(spaceId, slug) {
    for (const [token, ref] of this.tokens.entries()) {
      if (ref.spaceId === spaceId && ref.slug === slug) this.tokens.delete(token);
    }
    const token = crypto.randomBytes(16).toString('hex');
    this.tokens.set(token, { spaceId, slug });
    this._persist();
    return token;
  }

  /** @returns {{spaceId: string, slug: string} | null} */
  resolve(token) {
    return this.tokens.get(token) || null;
  }

  revoke(token) {
    const existed = this.tokens.delete(token);
    if (existed) this._persist();
    return existed;
  }
}

module.exports = { ShareTokenStore };
