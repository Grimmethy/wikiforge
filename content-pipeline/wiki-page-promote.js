'use strict';

// Stage 2 -- mirrors deadcode_fix's role as the consumer of stage 1's vetted candidates,
// but with its own simple next() instead of agent-manager core's generic
// nextCandidateFulfillmentTask SDK: that SDK's grounding is code-anchor-shaped (backtick-
// quoted symbols, line citations) and not a good fit for prose wiki content, and there's
// no code-drift problem here to re-ground against -- a candidate's content was already
// fully vetted at stage 1, so this stage is a publish confirmation, not a re-draft.

const path = require('path');
const fs = require('fs');
const { registerTaskSource } = require('agent-manager/src/task-source-registry.js');
const { nextUnpromotedCandidate, markCandidatePromoted, unpromotedCountForTranscript } = require('./candidate-block.js');
const { readCoverage, updateCoverageEntry } = require('./coverage-store.js');
const { wikiPagePromotePlanPrompt, wikiPagePromoteImplementPrompt } = require('./prompts.js');

function slugifyForId(str) {
  return String(str).toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').replace(/[^a-z0-9]+/g, '-');
}

function nextWikiPagePromoteTask({ spaces, taskIdExistsInQueue }) {
  for (const [spaceId, space] of Object.entries(spaces)) {
    const candidate = nextUnpromotedCandidate(space.contentRepoRoot);
    if (!candidate) continue;
    const taskId = `wiki-promote-${slugifyForId(spaceId)}-${slugifyForId(candidate.slug)}`;
    if (taskIdExistsInQueue(taskId)) continue;

    return {
      id: taskId,
      domain: 'wiki_content',
      source: 'wiki_page_promote',
      title: `Publish confirmation: ${candidate.title} (${space.label})`,
      promptContext: {
        spaceId,
        transcriptId: candidate.transcriptId,
        category: candidate.category,
        slug: candidate.slug,
        title: candidate.title,
        markdown: candidate.markdown,
      },
    };
  }
  return null;
}

// The real write: the vetted promptContext fields (never the model's re-emitted text --
// there is nothing to re-emit; CONFIRMED/FLAG-ISSUE is a yes/no gate, not a redraft) become
// a real page file. Refuses to overwrite an existing page, same safety property
// propertyforager-wiki's own promote-candidate.js already has. A FLAG-ISSUE verdict marks
// the candidate disposed-of (so it's never re-surfaced as "next") without publishing it --
// a human can grep the candidates doc for "SKIPPED" to find anything held back this way.
function applyWikiPagePromote({ task, spaces }) {
  const space = spaces[task.promptContext.spaceId];
  if (!space) return { skipped: true, reason: `unknown space "${task.promptContext.spaceId}" -- spaces.json may have changed since this task was queued` };

  const { transcriptId, category, slug, title, markdown } = task.promptContext;
  const candidate = { category, slug, title };
  const response = String(task.implementResponse || '').trim();

  // Disposes of this candidate in the doc (so it's never re-surfaced as "next") and, once
  // EVERY page a transcript produced has been disposed of one way or another, flips that
  // transcript's coverage entry from 'queued' to 'done' -- shared by every exit path below,
  // successful publish or not, since a FLAG-ISSUE/overwrite-refusal is still a real,
  // finished disposition, just not a publish.
  function disposeCandidate(marker, pageRelPath) {
    markCandidatePromoted(space.contentRepoRoot, candidate, marker);
    if (!transcriptId) return;
    const coverage = readCoverage(space.contentRepoRoot);
    const entry = coverage[transcriptId];
    const pages = entry && Array.isArray(entry.pages) ? entry.pages : [];
    const stillQueued = unpromotedCountForTranscript(space.contentRepoRoot, transcriptId) > 0;
    updateCoverageEntry(space.contentRepoRoot, transcriptId, {
      pages: pageRelPath && !pages.includes(pageRelPath) ? [...pages, pageRelPath] : pages,
      status: stillQueued ? 'queued' : 'done',
    });
  }

  if (/^FLAG-ISSUE\b/i.test(response)) {
    disposeCandidate(`SKIPPED (${response})`, null);
    return { skipped: true, reason: `${slug}: held back from publish -- ${response}` };
  }

  const outPath = path.join(space.contentRepoRoot, category, `${slug}.md`);
  if (fs.existsSync(outPath)) {
    disposeCandidate(`SKIPPED (a page already exists at ${path.relative(space.contentRepoRoot, outPath)})`, null);
    return { skipped: true, reason: `${slug}: refusing to overwrite existing page ${outPath}` };
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${markdown}\n`);
  const relPath = path.relative(space.contentRepoRoot, outPath);
  disposeCandidate(relPath, relPath);

  return { file: outPath };
}

function register({ spaces, taskIdExistsInQueue }) {
  registerTaskSource('wiki_page_promote', {
    priority: 82, // lower number than wiki_transcript_extract's 90 -- consumer outranks its own generator, same convention as every other review/fix pair (e.g. deadcode_fix:82 vs unused_export:90)
    next: () => nextWikiPagePromoteTask({ spaces, taskIdExistsInQueue }),
    buildPlanPrompt: wikiPagePromotePlanPrompt,
    buildImplementPrompt: wikiPagePromoteImplementPrompt,
    // Same reasoning as wiki_transcript_extract's noAutoRetry -- see that file's comment.
    noAutoRetry: true,
  });
}

module.exports = { register, nextWikiPagePromoteTask, applyWikiPagePromote };
