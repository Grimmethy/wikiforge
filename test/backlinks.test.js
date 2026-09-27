'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractOutgoingLinks, buildBacklinkIndex, slugify } = require('../src/backlinks');

test('extractOutgoingLinks: plain [[Target]] links', () => {
  const body = 'See [[Project Alpha]] and also [[Project Beta]].';
  assert.deepEqual(extractOutgoingLinks(body), ['project-alpha', 'project-beta']);
});

test('extractOutgoingLinks: [[Target|Label]] links use the target, not the label', () => {
  const body = 'Check [[project-alpha|the alpha project]] for details.';
  assert.deepEqual(extractOutgoingLinks(body), ['project-alpha']);
});

test('extractOutgoingLinks: duplicate links are deduplicated, first-seen order kept', () => {
  const body = '[[B]] then [[A]] then [[B]] again';
  assert.deepEqual(extractOutgoingLinks(body), ['b', 'a']);
});

test('extractOutgoingLinks: a body with no links returns an empty array', () => {
  assert.deepEqual(extractOutgoingLinks('just plain text'), []);
});

test('slugify: case and whitespace normalized', () => {
  assert.equal(slugify('  Project Alpha  '), 'project-alpha');
});

test('buildBacklinkIndex: builds target -> sources correctly across multiple pages', () => {
  const pages = [
    { slug: 'a', body: 'links to [[B]] and [[C]]' },
    { slug: 'b', body: 'links to [[C]]' },
    { slug: 'c', body: 'no links here' },
  ];
  const index = buildBacklinkIndex(pages);
  assert.deepEqual(index.get('b'), ['a']);
  assert.deepEqual(index.get('c').sort(), ['a', 'b']);
  assert.equal(index.get('a'), undefined);
});

test('buildBacklinkIndex: a page linking to itself twice only appears once in its own backlinks', () => {
  const pages = [{ slug: 'a', body: '[[A]] and [[a]] again' }];
  const index = buildBacklinkIndex(pages);
  assert.deepEqual(index.get('a'), ['a']);
});
