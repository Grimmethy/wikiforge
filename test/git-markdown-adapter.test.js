'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { GitMarkdownAdapter } = require('../src/storage/git-markdown-adapter');

// Runs against a real, throwaway git repo under the OS temp dir -- never the live
// SecondBrain vault -- so these tests can freely write/delete without any risk to real
// data. This mirrors the exact structure real vault content has (a plain "# Title"
// heading, no frontmatter) so the adapter is proven against the real shape it will
// actually be pointed at, not an invented one.

function makeTempGitRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiforge-adapter-test-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'first-page.md'), '# First Page\n\nSome body text with [[Second Page]].\n');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: dir });
  return dir;
}

test('GitMarkdownAdapter: listPages finds real markdown files and derives titles from the heading', async () => {
  const dir = makeTempGitRepo();
  const adapter = new GitMarkdownAdapter(dir);
  const list = await adapter.listPages();
  assert.equal(list.length, 1);
  assert.equal(list[0].slug, 'first-page');
  assert.equal(list[0].title, 'First Page');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('GitMarkdownAdapter: readPage returns the real body, and null for a missing slug', async () => {
  const dir = makeTempGitRepo();
  const adapter = new GitMarkdownAdapter(dir);
  const page = await adapter.readPage('first-page');
  assert.equal(page.title, 'First Page');
  assert.match(page.body, /\[\[Second Page\]\]/);
  assert.deepEqual(page.fields, {});
  assert.equal(await adapter.readPage('no-such-page'), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('GitMarkdownAdapter: writePage writes the file for real and produces a real git commit', async () => {
  const dir = makeTempGitRepo();
  const adapter = new GitMarkdownAdapter(dir);
  await adapter.writePage('new-page', { body: '# New Page\n\nbody', fields: {} });
  assert.ok(fs.existsSync(path.join(dir, 'new-page.md')));
  const log = execFileSync('git', ['-C', dir, 'log', '--oneline'], { encoding: 'utf8' });
  assert.match(log, /update new-page/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('GitMarkdownAdapter: writePage round-trips typed fields via frontmatter', async () => {
  const dir = makeTempGitRepo();
  const adapter = new GitMarkdownAdapter(dir);
  await adapter.writePage('typed-page', { body: '# Typed Page\n\nbody', fields: { status: 'open' } });
  const page = await adapter.readPage('typed-page');
  assert.deepEqual(page.fields, { status: 'open' });
  assert.match(page.body, /^# Typed Page/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('GitMarkdownAdapter: deletePage removes the file and commits the deletion', async () => {
  const dir = makeTempGitRepo();
  const adapter = new GitMarkdownAdapter(dir);
  await adapter.deletePage('first-page');
  assert.equal(fs.existsSync(path.join(dir, 'first-page.md')), false);
  const log = execFileSync('git', ['-C', dir, 'log', '--oneline'], { encoding: 'utf8' });
  assert.match(log, /delete first-page/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('GitMarkdownAdapter: listRevisions returns real git history for a page', async () => {
  const dir = makeTempGitRepo();
  const adapter = new GitMarkdownAdapter(dir);
  await adapter.writePage('first-page', { body: '# First Page\n\nedited body', fields: {} });
  const revisions = await adapter.listRevisions('first-page');
  assert.ok(revisions.length >= 2);
  assert.match(revisions[0].summary, /update first-page/);
  assert.ok(revisions[0].revisionId);
  assert.ok(revisions[0].at);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('GitMarkdownAdapter: works against a plain, non-git markdown directory (no crash, revisions empty)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wikiforge-adapter-nongit-'));
  fs.writeFileSync(path.join(dir, 'plain.md'), '# Plain\n\nno git here');
  const adapter = new GitMarkdownAdapter(dir);
  assert.equal(adapter.isGit, false);
  const page = await adapter.readPage('plain');
  assert.equal(page.title, 'Plain');
  assert.deepEqual(await adapter.listRevisions('plain'), []);
  await adapter.writePage('plain2', { body: '# Plain 2', fields: {} });
  assert.ok(fs.existsSync(path.join(dir, 'plain2.md')));
  fs.rmSync(dir, { recursive: true, force: true });
});
