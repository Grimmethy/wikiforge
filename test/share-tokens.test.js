'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ShareTokenStore } = require('../src/share-tokens');

test('ShareTokenStore: issue then resolve returns the same space/slug', () => {
  const store = new ShareTokenStore(null);
  const token = store.issue('agent-manager', 'some-page');
  assert.deepEqual(store.resolve(token), { spaceId: 'agent-manager', slug: 'some-page' });
});

test('ShareTokenStore: resolving an unknown token returns null', () => {
  const store = new ShareTokenStore(null);
  assert.equal(store.resolve('nope'), null);
});

test('ShareTokenStore: re-issuing for the same page revokes the old token', () => {
  const store = new ShareTokenStore(null);
  const first = store.issue('agent-manager', 'some-page');
  const second = store.issue('agent-manager', 'some-page');
  assert.notEqual(first, second);
  assert.equal(store.resolve(first), null);
  assert.deepEqual(store.resolve(second), { spaceId: 'agent-manager', slug: 'some-page' });
});

test('ShareTokenStore: revoke removes a token', () => {
  const store = new ShareTokenStore(null);
  const token = store.issue('agent-manager', 'some-page');
  assert.equal(store.revoke(token), true);
  assert.equal(store.resolve(token), null);
});

test('ShareTokenStore: persists across instances via a real file', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wikiforge-tokens-')), 'tokens.json');
  const store1 = new ShareTokenStore(file);
  const token = store1.issue('agent-manager', 'some-page');
  const store2 = new ShareTokenStore(file);
  assert.deepEqual(store2.resolve(token), { spaceId: 'agent-manager', slug: 'some-page' });
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});
