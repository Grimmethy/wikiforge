'use strict';

// Stage 1 -- mirrors agent-manager-hygiene's unused_export triage shape: turn the oldest
// unprocessed real source item (a whole transcript file here, not a code flag) into a
// judgment-and-draft task. Scanning cost is cheap (a directory listing + a coverage.json
// lookup over ~146 files, not a full-repo scan), so next() does the "scan" synchronously
// on every poll -- no separate scanner CLI/flags-file layer needed, the same way
// project_search's next() picks its own next query directly.

const fs = require('fs');
const path = require('path');
const { registerTaskSource } = require('agent-manager/src/task-source-registry.js');
const { isCovered, readCoverage, updateCoverageEntry } = require('./coverage-store.js');
const { appendCandidates, candidatesDocPath } = require('./candidate-block.js');
const { wikiTranscriptExtractPlanPrompt, wikiTranscriptExtractImplementPrompt } = require('./prompts.js');

function slugifyForId(str) {
  return String(str).toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '').replace(/[^a-z0-9]+/g, '-');
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

// Real, live incident (2026-09-28): a transcript's own pages all came back slugged with
// the GENERATION date (today, whenever the draft happened to run) instead of the real
// session date -- harmless to content but wrong metadata, and not something worth trusting
// the model to get right by instruction alone (same "don't rely on compliance for
// something you can compute" reasoning as the grounding-rules fix). Parsed here from the
// transcript filename's own `GMT<yyyymmdd>-<hhmmss>` stamp, deterministically, and both
// told to the model (prompts.js) AND enforced afterward (candidate-block.js rewrites any
// mismatched slug date prefix regardless of what the model wrote).
function sessionDateFromTranscriptId(transcriptId) {
  const m = /^GMT(\d{4})(\d{2})(\d{2})-\d{6}$/.exec(transcriptId);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function nextWikiTranscriptExtractTask({ spaces, taskIdExistsInQueue }) {
  for (const [spaceId, space] of Object.entries(spaces)) {
    let files;
    try {
      files = fs.readdirSync(space.sourcePool).filter((f) => !f.startsWith('.'));
    } catch {
      continue; // sourcePool missing/unreadable -- skip this space, don't crash the whole poll
    }
    files.sort(); // transcript filenames (GMT<yyyymmdd>-<hhmmss>.ext) sort chronologically as plain strings
    const coverage = readCoverage(space.contentRepoRoot);

    for (const file of files) {
      const transcriptId = path.basename(file, path.extname(file));
      if (isCovered(coverage, transcriptId)) continue;
      const taskId = `wiki-extract-${slugifyForId(spaceId)}-${slugifyForId(transcriptId)}`;
      if (taskIdExistsInQueue(taskId)) continue;

      const transcriptText = readIfExists(path.join(space.sourcePool, file));
      if (transcriptText == null) continue; // unreadable -- leave uncovered, try again next poll

      return {
        id: taskId,
        domain: 'wiki_content',
        source: 'wiki_transcript_extract',
        title: `Extract wiki-page candidate(s) from transcript ${transcriptId} (${space.label})`,
        promptContext: {
          spaceId,
          spaceLabel: space.label,
          transcriptId,
          transcriptText,
          categories: space.categories,
          sessionDate: sessionDateFromTranscriptId(transcriptId),
        },
      };
    }
  }
  return null;
}

// The real write: an approved draft's ===PAGE=== block(s) (or NO_SUBSTANTIVE_CONTENT) get
// appended to <contentRepoRoot>/Docs/WIKI_PAGE_CANDIDATES.md -- plain filesystem write, no
// git operations (same non-git shape as research/project_search today; a human still runs
// git add/commit in the content repo). Always marks the transcript covered either way, so
// it's never regenerated as a duplicate task regardless of outcome.
function applyWikiTranscriptExtract({ task, spaces }) {
  const space = spaces[task.promptContext.spaceId];
  if (!space) return { skipped: true, reason: `unknown space "${task.promptContext.spaceId}" -- spaces.json may have changed since this task was queued` };

  const { transcriptId, sessionDate } = task.promptContext;
  const response = String(task.implementResponse || '').trim();

  if (/^NO_SUBSTANTIVE_CONTENT\b/i.test(response)) {
    updateCoverageEntry(space.contentRepoRoot, transcriptId, { status: 'skipped-no-content', method: 'pipeline', at: new Date().toISOString() });
    return { skipped: true, reason: `${transcriptId}: no substantive content -- ${response}` };
  }

  const { appended, invalidCount } = appendCandidates(space.contentRepoRoot, { transcriptId, validCategories: space.categories, sessionDate }, response);
  if (appended === 0) {
    updateCoverageEntry(space.contentRepoRoot, transcriptId, { status: 'skipped-no-content', method: 'pipeline', at: new Date().toISOString() });
    return { skipped: true, reason: `${transcriptId}: no valid page block(s) found in implement response (${invalidCount} invalid-category block(s) dropped)` };
  }

  updateCoverageEntry(space.contentRepoRoot, transcriptId, { status: 'queued', method: 'pipeline', at: new Date().toISOString() });
  return { file: candidatesDocPath(space.contentRepoRoot), appended, invalidCount };
}

function register({ spaces, taskIdExistsInQueue }) {
  registerTaskSource('wiki_transcript_extract', {
    priority: 90,
    next: () => nextWikiTranscriptExtractTask({ spaces, taskIdExistsInQueue }),
    buildPlanPrompt: wikiTranscriptExtractPlanPrompt,
    buildImplementPrompt: wikiTranscriptExtractImplementPrompt,
    // No `apply` field here -- the wiki_content domain never reaches writeArtifact's
    // per-source dispatch (apply-task.js intercepts the whole domain before that point).
    // Real application happens through the wiki-content-apply-route.js seam registered in
    // register.js, which dispatches on task.source to applyWikiTranscriptExtract below.
  });
}

module.exports = { register, nextWikiTranscriptExtractTask, applyWikiTranscriptExtract };
