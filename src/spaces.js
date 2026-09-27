'use strict';

// A Space is Docmost's multi-tenancy primitive: one running WikiForge service, each
// consuming project (agent-manager, PropertyForager, future ones) gets its own isolated
// space, bound to exactly one storage adapter at registration. Nothing else in
// WikiForge should reach into a space's adapter directly -- go through getSpace().

const spaces = new Map();

/** @param {string} id @param {import('./storage/storage-adapter').StorageAdapter} adapter */
function registerSpace(id, adapter, { name } = {}) {
  if (spaces.has(id)) throw new Error(`space "${id}" already registered`);
  spaces.set(id, { id, name: name || id, adapter });
}

function getSpace(id) {
  const space = spaces.get(id);
  if (!space) throw new Error(`no such space: ${id}`);
  return space;
}

function listSpaces() {
  return Array.from(spaces.values()).map(({ id, name }) => ({ id, name }));
}

/** Test/reset helper -- not used by the running server. */
function _clearAllSpaces() {
  spaces.clear();
}

module.exports = { registerSpace, getSpace, listSpaces, _clearAllSpaces };
