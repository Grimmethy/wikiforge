'use strict';

// Tiny read/update helper for a content space's <contentRepoRoot>/pipeline/coverage.json --
// the same flat { [transcriptId]: { status, method, at, pages } } map propertyforager-wiki's
// own hand-run promote-candidate.js already established (4 real "manual" entries exist
// there today). Deliberately NOT agent-manager-hygiene's flag-store.js/reconcileFlags: that
// module solves line-number drift for findings INSIDE a file that keeps changing -- a
// transcript is a whole, static, immutable source file, either processed or not, so there's
// no drift problem to reconcile and a flat coverage map is the right shape as-is.

const fs = require('fs');
const path = require('path');
const { writeJsonAtomicSync } = require('agent-manager/src/atomic-write.js');

function coveragePath(contentRepoRoot) {
  return path.join(contentRepoRoot, 'pipeline', 'coverage.json');
}

function readCoverage(contentRepoRoot) {
  const file = coveragePath(contentRepoRoot);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

// A transcript counts as "already handled" once it has ANY entry at all -- 'done',
// 'queued' (candidate written, awaiting promotion), or 'skipped-no-content' all mean
// next() should move on to the next transcript, not regenerate a duplicate task for it.
function isCovered(coverage, id) {
  return Object.prototype.hasOwnProperty.call(coverage, id);
}

function updateCoverageEntry(contentRepoRoot, id, patch) {
  const dir = path.join(contentRepoRoot, 'pipeline');
  fs.mkdirSync(dir, { recursive: true });
  const coverage = readCoverage(contentRepoRoot);
  coverage[id] = { ...coverage[id], ...patch };
  writeJsonAtomicSync(coveragePath(contentRepoRoot), coverage);
  return coverage[id];
}

module.exports = { coveragePath, readCoverage, isCovered, updateCoverageEntry };
