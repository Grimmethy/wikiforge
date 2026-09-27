'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listTemplates, getTemplate, renderTemplate } = require('../src/templates');

test('listTemplates: returns id/label/description for every real template, no bodies', () => {
  const list = listTemplates();
  assert.ok(list.length >= 4);
  for (const t of list) {
    assert.ok(t.id);
    assert.ok(t.label);
    assert.ok(t.description);
    assert.equal(t.body, undefined);
  }
});

test('getTemplate: returns null for an unknown id', () => {
  assert.equal(getTemplate('no-such-template'), null);
});

test('renderTemplate: substitutes the given title into the body and default fields', () => {
  const rendered = renderTemplate('guide', { title: 'How to reboot the P40' });
  assert.equal(rendered.title, 'How to reboot the P40');
  assert.match(rendered.body, /^# How to reboot the P40/);
  assert.deepEqual(rendered.fields, { category: 'Guides', type: 'guide' });
});

test('renderTemplate: falls back to the template label when no title is given', () => {
  const rendered = renderTemplate('reference', {});
  assert.equal(rendered.title, 'Reference');
});

test('renderTemplate: returns null for an unknown template id', () => {
  assert.equal(renderTemplate('nope', { title: 'x' }), null);
});

test('renderTemplate: each call returns an independent fields object (no shared-mutation risk)', () => {
  const a = renderTemplate('guide', { title: 'A' });
  const b = renderTemplate('guide', { title: 'B' });
  a.fields.category = 'Mutated';
  assert.equal(b.fields.category, 'Guides');
});
