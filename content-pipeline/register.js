'use strict';

// AGENT_MANAGER_REGISTER_PATH entry point for the wiki content pipeline: turns real source
// material (coaching-call transcripts today; any per-space source pool tomorrow) into
// reviewed wiki-page candidates and, once approved, real pages in a WikiForge content-space
// repo (propertyforager-wiki today). Same two-stage "scan -> candidate task -> review ->
// real write" shape agent-manager-hygiene uses for code (see unused-export.js there), but
// registered as its OWN registerPath entry -- kept separate from wikiforge's existing
// register.js/register-am-wiki.js (which back the SecondBrain/Agent-Manager-Wiki dashboard
// tabs and are deliberate no-ops) for separation of concerns, even though one registerPath
// file could technically carry both a tab and task sources.
//
// The `agent-manager` dependency is a file: link (see package.json) and MUST resolve, via
// realpath, to the exact checkout core itself runs from -- same symlink discipline
// agent-manager-hygiene's own register.js documents (`ls -la node_modules/agent-manager`
// must show a symlink; never run node with --preserve-symlinks).

const { taskIdExistsInQueue } = require('agent-manager/src/task-sources.js');
const { setWikiContentApply } = require('agent-manager/src/wiki-content-apply-route.js');
const spaces = require('./spaces.json');
const { register: registerExtract, applyWikiTranscriptExtract } = require('./wiki-transcript-extract.js');
const { register: registerPromote, applyWikiPagePromote } = require('./wiki-page-promote.js');

registerExtract({ spaces, taskIdExistsInQueue });
registerPromote({ spaces, taskIdExistsInQueue });

// wiki_content is one domain shared by two sources -- apply-task.js's domain interception
// calls this ONE seam per task (never each source's own registered `apply` field, which
// this domain never reaches), so dispatch on task.source ourselves.
setWikiContentApply(({ task }) => {
  if (task.source === 'wiki_transcript_extract') return applyWikiTranscriptExtract({ task, spaces });
  if (task.source === 'wiki_page_promote') return applyWikiPagePromote({ task, spaces });
  throw new Error(`wiki_content task ${task.id}: unknown source "${task.source}" -- no apply handler registered for it`);
});
