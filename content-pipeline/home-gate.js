'use strict';

// Home-pipeline gate for the wiki task sources. The plugin is loaded by every pipeline, but
// the work (and its coverage record) belongs to ONE space, so each space names the single
// pipeline allowed to mint tasks for it (`homePipelineDir` in spaces.json). Without this
// every pipeline minted its own copy of every uncovered transcript (124 identical ids in
// ~19 pipelines on 2026-11-13). Fails closed: a missing homePipelineDir, an unset
// AGENT_MANAGER_PIPELINE_DIR, or any mismatch means "not home" and nothing is emitted.

const fs = require('fs');
const path = require('path');

function resolveDir(dir) {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

function isHomePipeline(space, env = process.env) {
  const home = space && typeof space.homePipelineDir === 'string' ? space.homePipelineDir.trim() : '';
  const current = env && typeof env.AGENT_MANAGER_PIPELINE_DIR === 'string' ? env.AGENT_MANAGER_PIPELINE_DIR.trim() : '';
  if (!home || !current) return false;
  return resolveDir(home) === resolveDir(current);
}

module.exports = { isHomePipeline };
