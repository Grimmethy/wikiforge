'use strict';

// wiki_page_promote's valid answer is the single word CONFIRMED / FLAG-ISSUE, so it must be registered advisoryProse: core's review gate otherwise blocks any
// fence-free answer under 80 characters as a bare tool-call request. Run: node --test test/wiki-page-promote-registration.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const { getRegisteredSource } = require('agent-manager/src/task-source-registry.js');
const { register } = require('../content-pipeline/wiki-page-promote.js');

test('wiki_page_promote registers as an advisoryProse source so a one-word CONFIRMED verdict is not blocked as a non-implementation', () => {
  register({ spaces: {}, taskIdExistsInQueue: () => false });
  const entry = getRegisteredSource('wiki_page_promote');
  assert.ok(entry, 'source registered');
  assert.equal(entry.advisoryProse, true);
  assert.equal(entry.noAutoRetry, true, 'existing registration flags are kept');
});
