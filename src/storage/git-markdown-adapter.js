'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { StorageAdapter } = require('./storage-adapter');

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

// Minimal `key: value` frontmatter parser -- deliberately not a full YAML parser.
// Real vault content (checked against /media/model-cache/github/SecondBrain) has no
// frontmatter at all today, so this only needs to (a) not choke on that, returning
// {} fields and the whole file as body, and (b) round-trip whatever WikiForge itself
// writes later. Nested structures are out of scope for v1.
function parseFrontmatter(raw) {
  const m = FRONTMATTER_RE.exec(raw);
  if (!m) return { fields: {}, body: raw };
  const fields = {};
  for (const line of m[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key) fields[key] = value;
  }
  return { fields, body: m[2] };
}

function serializeFrontmatter(fields, body) {
  const keys = Object.keys(fields || {});
  if (keys.length === 0) return body;
  const lines = keys.map((k) => `${k}: ${fields[k]}`);
  return `---\n${lines.join('\n')}\n---\n${body}`;
}

function slugToRelPath(slug) {
  return `${slug}.md`;
}

function relPathToSlug(relPath) {
  return relPath.slice(0, -3);
}

function titleFromBody(body, fallbackSlug) {
  const heading = /^#\s+(.+)$/m.exec(body);
  if (heading) return heading[1].trim();
  return fallbackSlug;
}

function isInsideGitWorkTree(root) {
  try {
    execFileSync('git', ['-C', root, 'rev-parse', '--is-inside-work-tree'], { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

function listMarkdownFilesRecursive(root, dir = root, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listMarkdownFilesRecursive(root, full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(path.relative(root, full));
    }
  }
  return acc;
}

// Reads (and optionally writes) a directory tree of plain markdown files as WikiForge
// pages -- the adapter agent-manager's own space uses, pointed at the real SecondBrain
// vault. Zero migration: the vault's existing files are read as-is. Git integration
// (commit-on-write, listRevisions via `git log`) is used only when `root` is actually
// inside a git work tree; otherwise writes are plain file writes and listRevisions
// returns []. This lets the adapter also work against a plain, non-git markdown
// directory (e.g. a test fixture) without special-casing callers.
class GitMarkdownAdapter extends StorageAdapter {
  constructor(root) {
    super();
    this.root = root;
    this.isGit = isInsideGitWorkTree(root);
  }

  async listPages() {
    return listMarkdownFilesRecursive(this.root).map((relPath) => {
      const slug = relPathToSlug(relPath);
      const raw = fs.readFileSync(path.join(this.root, relPath), 'utf8');
      const { body } = parseFrontmatter(raw);
      const stat = fs.statSync(path.join(this.root, relPath));
      return { slug, title: titleFromBody(body, slug), updatedAt: stat.mtime.toISOString() };
    });
  }

  async readPage(slug) {
    const relPath = slugToRelPath(slug);
    const full = path.join(this.root, relPath);
    if (!fs.existsSync(full)) return null;
    const raw = fs.readFileSync(full, 'utf8');
    const { fields, body } = parseFrontmatter(raw);
    const stat = fs.statSync(full);
    return { slug, title: titleFromBody(body, slug), body, fields, updatedAt: stat.mtime.toISOString() };
  }

  async writePage(slug, page) {
    const relPath = slugToRelPath(slug);
    const full = path.join(this.root, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, serializeFrontmatter(page.fields, page.body));
    if (this.isGit) {
      execFileSync('git', ['-C', this.root, 'add', relPath]);
      try {
        execFileSync('git', ['-C', this.root, 'commit', '-m', `WikiForge: update ${slug}`], { stdio: 'ignore' });
      } catch {
        // Nothing to commit (identical content) -- not an error.
      }
    }
  }

  async deletePage(slug) {
    const relPath = slugToRelPath(slug);
    const full = path.join(this.root, relPath);
    if (!fs.existsSync(full)) return;
    fs.unlinkSync(full);
    if (this.isGit) {
      execFileSync('git', ['-C', this.root, 'add', '-A', relPath]);
      try {
        execFileSync('git', ['-C', this.root, 'commit', '-m', `WikiForge: delete ${slug}`], { stdio: 'ignore' });
      } catch {
        // Nothing to commit.
      }
    }
  }

  async listRevisions(slug) {
    if (!this.isGit) return [];
    const relPath = slugToRelPath(slug);
    const full = path.join(this.root, relPath);
    if (!fs.existsSync(full)) return [];
    const out = execFileSync(
      'git',
      ['-C', this.root, 'log', '--follow', '--format=%H%x1f%aI%x1f%s', '--', relPath],
      { encoding: 'utf8' },
    );
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [revisionId, at, summary] = line.split('\x1f');
        return { revisionId, at, summary };
      });
  }
}

module.exports = { GitMarkdownAdapter };
