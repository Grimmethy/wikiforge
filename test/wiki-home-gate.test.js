'use strict';

// The wiki task sources mint tasks only from a space's home pipeline (content-pipeline/home-gate.js). Run: node --test test/wiki-home-gate.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isHomePipeline } = require('../content-pipeline/home-gate.js');
const { nextWikiTranscriptExtractTask } = require('../content-pipeline/wiki-transcript-extract.js');
const { nextWikiPagePromoteTask } = require('../content-pipeline/wiki-page-promote.js');
const { appendCandidates } = require('../content-pipeline/candidate-block.js');

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `wiki-home-gate-${prefix}-`));
}

// A space with one uncovered transcript and one unpromoted candidate page, homed at `homeDir`.
function makeSpace(homeDir) {
  const sourcePool = tmp('pool');
  const contentRepoRoot = tmp('content');
  fs.writeFileSync(path.join(sourcePool, 'GMT20260115-200020.txt'), 'coach: talk about liens');
  const response = '===PAGE===\nCATEGORY: Liens & Tax Sales\nSLUG: 2026-01-15-lien-basics\nTITLE: Lien basics\n\n# Lien basics\n\nBody.\n===END PAGE===';
  const { appended } = appendCandidates(contentRepoRoot, { transcriptId: 'GMT20260099-000000', validCategories: ['Liens & Tax Sales'], sessionDate: null }, response);
  assert.equal(appended, 1, 'fixture candidate written');
  const space = { label: 'Test space', sourcePool, contentRepoRoot, categories: ['Liens & Tax Sales'] };
  if (homeDir !== undefined) space.homePipelineDir = homeDir;
  return space;
}

const notQueued = () => false;

test('isHomePipeline is true when AGENT_MANAGER_PIPELINE_DIR is the space home dir', () => {
  const home = tmp('home');
  assert.equal(isHomePipeline({ homePipelineDir: home }, { AGENT_MANAGER_PIPELINE_DIR: home }), true);
});

test('isHomePipeline sees through a symlinked spelling of the same dir', () => {
  const home = tmp('home');
  const link = path.join(tmp('linkparent'), 'alias');
  fs.symlinkSync(home, link);
  assert.equal(isHomePipeline({ homePipelineDir: home }, { AGENT_MANAGER_PIPELINE_DIR: link }), true);
  assert.equal(isHomePipeline({ homePipelineDir: link }, { AGENT_MANAGER_PIPELINE_DIR: home }), true);
});

test('isHomePipeline is false for a different pipeline dir', () => {
  assert.equal(isHomePipeline({ homePipelineDir: tmp('home') }, { AGENT_MANAGER_PIPELINE_DIR: tmp('other') }), false);
});

test('isHomePipeline fails closed when homePipelineDir is missing or empty', () => {
  const dir = tmp('any');
  assert.equal(isHomePipeline({}, { AGENT_MANAGER_PIPELINE_DIR: dir }), false);
  assert.equal(isHomePipeline({ homePipelineDir: '' }, { AGENT_MANAGER_PIPELINE_DIR: dir }), false);
  assert.equal(isHomePipeline({ homePipelineDir: '   ' }, { AGENT_MANAGER_PIPELINE_DIR: dir }), false);
});

test('isHomePipeline fails closed when AGENT_MANAGER_PIPELINE_DIR is unset', () => {
  assert.equal(isHomePipeline({ homePipelineDir: tmp('home') }, {}), false);
});

test('wiki_transcript_extract mints nothing from a non-home pipeline even with an uncovered transcript', () => {
  const home = tmp('home');
  const spaces = { propertyforager: makeSpace(home) };
  const task = nextWikiTranscriptExtractTask({ spaces, taskIdExistsInQueue: notQueued, env: { AGENT_MANAGER_PIPELINE_DIR: tmp('storyforge') } });
  assert.equal(task, null);
});

test('wiki_transcript_extract mints the next uncovered transcript from the home pipeline', () => {
  const home = tmp('home');
  const spaces = { propertyforager: makeSpace(home) };
  const task = nextWikiTranscriptExtractTask({ spaces, taskIdExistsInQueue: notQueued, env: { AGENT_MANAGER_PIPELINE_DIR: home } });
  assert.ok(task, 'task minted at home');
  assert.equal(task.id, 'wiki-extract-propertyforager-gmt20260115-200020');
  assert.equal(task.source, 'wiki_transcript_extract');
});

test('wiki_transcript_extract mints nothing for a space with no homePipelineDir (fail closed)', () => {
  const spaces = { propertyforager: makeSpace(undefined) };
  const task = nextWikiTranscriptExtractTask({ spaces, taskIdExistsInQueue: notQueued, env: { AGENT_MANAGER_PIPELINE_DIR: tmp('anywhere') } });
  assert.equal(task, null);
});

test('wiki_page_promote mints nothing from a non-home pipeline', () => {
  const home = tmp('home');
  const spaces = { propertyforager: makeSpace(home) };
  const task = nextWikiPagePromoteTask({ spaces, taskIdExistsInQueue: notQueued, env: { AGENT_MANAGER_PIPELINE_DIR: tmp('videoforge') } });
  assert.equal(task, null);
});

test('wiki_page_promote still mints the next unpromoted candidate from the home pipeline', () => {
  const home = tmp('home');
  const spaces = { propertyforager: makeSpace(home) };
  const task = nextWikiPagePromoteTask({ spaces, taskIdExistsInQueue: notQueued, env: { AGENT_MANAGER_PIPELINE_DIR: home } });
  assert.ok(task, 'task minted at home');
  assert.equal(task.id, 'wiki-promote-propertyforager-2026-01-15-lien-basics');
  assert.equal(task.source, 'wiki_page_promote');
});

test('both sources read the real spaces.json and name a home pipeline for every space', () => {
  const spaces = require('../content-pipeline/spaces.json');
  for (const [id, space] of Object.entries(spaces)) {
    assert.ok(typeof space.homePipelineDir === 'string' && space.homePipelineDir.length > 0, `${id} has homePipelineDir`);
  }
});
