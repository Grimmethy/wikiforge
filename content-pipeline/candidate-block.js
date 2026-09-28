'use strict';

// Parse/format helpers for the ===PAGE===/CATEGORY/SLUG/TITLE candidate-page format --
// ported from propertyforager-wiki/pipeline/promote-candidate.js's own parser (already
// proven against the 4 real manually-classified sessions), generalized so the SAME format
// serves both a model's raw implement-response text (stage 1) and the accumulated
// Docs/WIKI_PAGE_CANDIDATES.md doc it gets appended into (stage 2 reads it back). A block
// gains an optional `PROMOTED: <page path>` metadata line once stage 2 has written the real
// page -- that's what lets stage 2's next() find the oldest still-unpromoted block.

const fs = require('fs');
const path = require('path');
const { writeAtomicSync } = require('agent-manager/src/atomic-write.js');

const CANDIDATES_DOC_TITLE = '# Wiki Page Candidates';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Returns [{ transcriptId, category, slug, title, markdown, promoted, blockText }], in
// document order (chronological, since stage 1's apply only ever appends). `transcriptId`
// is read off the nearest preceding `## Transcript <id>` section heading appendCandidates
// writes -- needed so stage 2 can attribute a promoted page back to the ONE transcript it
// came from (not every currently-"queued" transcript) when updating coverage.json. Parsing
// a stage-1 implement response directly (no heading yet) yields `transcriptId: null`,
// which stage 1 doesn't need -- it already knows its own transcriptId from promptContext.
function parsePageBlocks(raw) {
  const text = String(raw || '');
  const headingRe = /^## Transcript (\S+).*$/gm;
  const headings = [];
  let m;
  while ((m = headingRe.exec(text))) headings.push({ transcriptId: m[1], start: m.index });
  const sections = headings.length > 0
    ? headings.map((h, i) => ({ transcriptId: h.transcriptId, text: text.slice(h.start, i + 1 < headings.length ? headings[i + 1].start : text.length) }))
    : [{ transcriptId: null, text }];

  const pages = [];
  for (const section of sections) {
    const blocks = section.text.split('===PAGE===').slice(1);
    for (const rawBlock of blocks) {
      const block = rawBlock.split('===END PAGE===')[0];
      const categoryMatch = /^CATEGORY:\s*(.+)$/m.exec(block);
      const slugMatch = /^SLUG:\s*(.+)$/m.exec(block);
      const titleMatch = /^TITLE:\s*(.+)$/m.exec(block);
      const promotedMatch = /^PROMOTED:\s*(.+)$/m.exec(block);
      if (!categoryMatch || !slugMatch) continue;
      const category = categoryMatch[1].trim();
      const slug = slugMatch[1].trim().replace(/\.md$/, '');
      const markdownStart = block.indexOf('\n# ');
      const markdown = markdownStart === -1 ? block : block.slice(markdownStart + 1);
      pages.push({
        transcriptId: section.transcriptId,
        category,
        slug,
        title: (titleMatch && titleMatch[1].trim()) || slug,
        markdown: markdown.trim(),
        promoted: promotedMatch ? promotedMatch[1].trim() : null,
        blockText: `===PAGE===${block}===END PAGE===`,
      });
    }
  }
  return pages;
}

// How many of THIS transcript's own candidate blocks are still unpromoted -- stage 2 uses
// this right after promoting one to decide whether the transcript's coverage entry can
// flip from "queued" to "done" yet (only once every page it produced has been promoted).
function unpromotedCountForTranscript(contentRepoRoot, transcriptId) {
  return parsePageBlocks(readCandidatesDoc(contentRepoRoot)).filter((p) => p.transcriptId === transcriptId && !p.promoted).length;
}

function candidatesDocPath(contentRepoRoot) {
  return path.join(contentRepoRoot, 'Docs', 'WIKI_PAGE_CANDIDATES.md');
}

function readCandidatesDoc(contentRepoRoot) {
  try {
    return fs.readFileSync(candidatesDocPath(contentRepoRoot), 'utf8');
  } catch {
    return `${CANDIDATES_DOC_TITLE}\n`;
  }
}

// Real, live incident (2026-09-28): a whole transcript's pages came back slugged with the
// GENERATION date (whenever the model happened to run) instead of the transcript's real
// session date, even though the format instructions asked for the real one -- a prompt-
// compliance failure like any other, not worth trusting the model to self-correct.
// Deterministically rewrites the slug's leading yyyy-mm-dd (replacing a wrong one, or
// prepending one if the model omitted it entirely) to `sessionDate`, in both the parsed
// `slug` field and the raw `blockText` that actually gets written to disk -- so the real
// page filename is always correct regardless of what the model wrote.
const SLUG_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
function withCorrectedSlugDate(page, sessionDate) {
  if (!sessionDate || SLUG_DATE_RE.test(page.slug) && page.slug.slice(0, 10) === sessionDate) return page;
  const rest = SLUG_DATE_RE.test(page.slug) ? page.slug.slice(10).replace(/^-+/, '') : page.slug;
  const slug = `${sessionDate}-${rest}`;
  const blockText = page.blockText.replace(/^SLUG:\s*.+$/m, `SLUG: ${slug}`);
  return { ...page, slug, blockText };
}

// Appends every valid page block found in `implementResponse` (an approved model draft,
// already reviewed) under a dated, transcript-id-headed section. Blocks whose CATEGORY
// isn't one of the space's real configured categories are skipped (not written at all --
// a fabricated category is a real drafting error, not something to silently coerce) and
// reported back so the caller can decide whether that counts as "nothing to queue."
// `sessionDate` (yyyy-mm-dd, optional) deterministically corrects each valid page's slug
// date prefix -- see withCorrectedSlugDate above.
function appendCandidates(contentRepoRoot, { transcriptId, validCategories, sessionDate }, implementResponse) {
  const parsed = parsePageBlocks(implementResponse);
  const valid = parsed.filter((p) => validCategories.includes(p.category)).map((p) => withCorrectedSlugDate(p, sessionDate));
  const invalidCount = parsed.length - valid.length;
  if (valid.length === 0) return { appended: 0, invalidCount };

  const dir = path.dirname(candidatesDocPath(contentRepoRoot));
  fs.mkdirSync(dir, { recursive: true });
  let doc = readCandidatesDoc(contentRepoRoot);
  const stamp = new Date().toISOString();
  const section = [`\n## Transcript ${transcriptId} -- queued ${stamp}\n`, ...valid.map((p) => `\n${p.blockText}\n`)].join('');
  doc = `${doc.trimEnd()}\n${section}`;
  writeAtomicSync(candidatesDocPath(contentRepoRoot), doc);
  return { appended: valid.length, invalidCount };
}

// The oldest (document-order-first) block with no PROMOTED: line yet, or null if every
// candidate currently in the doc has already been promoted (or none exist).
function nextUnpromotedCandidate(contentRepoRoot) {
  const doc = readCandidatesDoc(contentRepoRoot);
  const pages = parsePageBlocks(doc);
  return pages.find((p) => !p.promoted) || null;
}

// Splices a `PROMOTED: <marker>` line right after the matching candidate's header
// (CATEGORY/SLUG/TITLE). Anchored on the whole header, not slug alone, and skips any
// occurrence that already carries a PROMOTED line: a bare slug-only anchor would silently
// patch the FIRST slug match anywhere in the doc, which is wrong (and corrupts an
// already-promoted entry instead) the moment the same slug appears twice -- a duplicate or
// resubmitted candidate, not even an especially rare case for a slug format that's just a
// date + short description. `candidate` is the exact object nextUnpromotedCandidate()
// returned (or an equivalent {category, slug, title}), so this always targets the specific
// occurrence the caller actually looked at.
function markCandidatePromoted(contentRepoRoot, candidate, marker) {
  const file = candidatesDocPath(contentRepoRoot);
  const doc = readCandidatesDoc(contentRepoRoot);
  const header = `CATEGORY: ${candidate.category}\nSLUG: ${candidate.slug}\nTITLE: ${candidate.title}`;
  const headerRe = new RegExp(escapeRegExp(header), 'g');
  let m;
  while ((m = headerRe.exec(doc))) {
    const afterHeader = m.index + m[0].length;
    const blockEnd = doc.indexOf('===END PAGE===', afterHeader);
    const between = doc.slice(afterHeader, blockEnd === -1 ? doc.length : blockEnd);
    if (/^PROMOTED:/m.test(between)) continue; // this occurrence already disposed of -- keep looking
    writeAtomicSync(file, `${doc.slice(0, afterHeader)}\nPROMOTED: ${marker}${doc.slice(afterHeader)}`);
    return true;
  }
  return false;
}

module.exports = { parsePageBlocks, candidatesDocPath, readCandidatesDoc, appendCandidates, nextUnpromotedCandidate, markCandidatePromoted, unpromotedCountForTranscript };
