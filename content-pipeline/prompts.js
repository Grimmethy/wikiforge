'use strict';

// buildPlanPrompt/buildImplementPrompt pairs for the two wiki_content sources, in the same
// stable/volatile-section style agent-manager core's prompts.js uses (e.g.
// unusedExportPlanPrompt/unusedExportImplementPrompt) -- built as plain string joins here
// rather than requiring core's lib/prompt-assembly.js, since assemblePrompt isn't part of
// the documented PLUGIN_API.md surface.

// Privacy bar for real coaching-call content (real students' first names, real deal
// numbers, sometimes personal circumstances) -- drafted against the 4 sessions already
// classified by hand as the quality/PII bar (see propertyforager-wiki/pipeline/
// coverage.json's "manual" entries and the pages they produced). Worth a human re-read
// before this runs unattended at volume -- flagged in the implementation plan, not just
// here.
const PRIVACY_RULES = [
  'First names of students/coaches may be kept exactly as used in the call (the existing manually-classified pages already do this, e.g. "Charlie", "Jason", coach "Mel Dorman") -- this is a private, invite-only coaching community, not public content, but first names alone are the established norm.',
  'Never include a last name, phone number, email address, physical street address, or account/loan number, even if stated in the transcript -- generalize instead (e.g. "a Seattle triplex", not the street address; "the underlying lender", not an account number).',
  'Real dollar figures, percentages, dates, and deal structure are the actual teaching value here and should be kept precise.',
  'If the transcript is pure small talk, admin/housekeeping, or otherwise has no real teachable content, say so -- do not stretch a thin session into a page.',
];

// Added 2026-09-27 after a real, repeated failure: the first live transcript run (a
// prospecting/direct-mail session) was rejected by review 3 times in a row, every time for
// fabrication -- a "10-3-1 Law"/"Rule of Three" framework the transcript never named, a
// "mail-handler QC workflow" invented wholesale where the transcript actually said the
// opposite (the instructor does the mailing personally), and specific questions attributed
// by name to real students who never asked them. PRIVACY_RULES above governs what to OMIT;
// this governs what may never be ADDED. The review stage caught every instance correctly --
// this exists so it stops having to.
const GROUNDING_RULES = [
  'Every named framework, rule, ratio, or technique you write (e.g. calling something a "Law", a numbered ratio like "10-3-1", a named strategy) must be the transcript\'s OWN name for it, used close to verbatim -- never coin, rename, or "clean up" a name the transcript did not actually use, and never invent one to make loose advice sound like a named framework.',
  'Never attribute a specific question, comment, or example to a named person (student or coach) unless the transcript actually shows that exact person saying or asking it. When you cannot tell who said something, describe it without a name ("a student asked...") or leave the attribution out entirely.',
  'Never write a "general workflow" section describing steps, tools, staff, or a process the coach did not actually describe -- if the transcript says the instructor does something personally, do not embellish it into a delegated/staffed process, and do not add plausible-sounding industry-standard steps that were never said.',
  'If you are not sure a specific detail was actually stated -- a number, a name, a quote, a "best practice" -- leave it out rather than filling the gap with something plausible. A shorter, sparser page that is entirely real beats a fuller one with invented specifics; the review pass will reject fabrication every time, so there is no upside to guessing.',
  'Prefer close paraphrase or short quotes of what was actually said over synthesizing/summarizing into a cleaner-sounding original formulation -- summarizing is fine, inventing detail while summarizing is not.',
];

function wikiTranscriptExtractPlanPrompt(task) {
  const ctx = task.promptContext;
  return [
    `You are scoping a wiki-content extraction pass over one real coaching-call transcript for the "${ctx.spaceLabel}" content space.`,
    'Write a short numbered PLAN: does this transcript contain real, teachable content, and if so, how many distinct wiki pages should it become and under which category(ies)?',
    '',
    `Real categories available (use ONLY these, exactly as spelled): ${ctx.categories.join(', ')}`,
    '',
    'GROUNDING RULES (the most important rules here -- a fabricated detail gets the whole draft rejected, every time):',
    ...GROUNDING_RULES.map((r) => `- ${r}`),
    '',
    'PRIVACY RULES (apply when you actually draft the page(s) in the next step, keep in mind now for scoping):',
    ...PRIVACY_RULES.map((r) => `- ${r}`),
    '',
    `Transcript ${ctx.transcriptId}:`,
    '---',
    ctx.transcriptText,
    '---',
  ].join('\n');
}

function wikiTranscriptExtractImplementPrompt(task, planText) {
  const ctx = task.promptContext;
  return [
    'Your plan above scoped this transcript. Now do the real extraction.',
    '',
    planText,
    '',
    'If the transcript genuinely has no teachable content (pure small talk, a near-empty call, housekeeping only), respond with EXACTLY:',
    'NO_SUBSTANTIVE_CONTENT: <one short sentence why>',
    '',
    'Before writing: re-read the GROUNDING RULES above. Every fact, name, number, and quote in the page you are about to write must trace back to something actually said in the transcript you were given above (in your own plan turn) -- do not add anything you cannot point to there.',
    '',
    'Otherwise, write one or more wiki pages, each in EXACTLY this format (must match this parser exactly or it cannot be consumed downstream):',
    '',
    '===PAGE===',
    `CATEGORY: <one of: ${ctx.categories.join(', ')}>`,
    `SLUG: ${ctx.sessionDate || '<yyyy-mm-dd>'}-<kebab-case-descriptive-slug, no .md extension> -- the date MUST be exactly ${ctx.sessionDate || 'the real session date'} (this transcript's own date, not today's date), never anything else`,
    'TITLE: <short descriptive title>',
    '',
    '# <the same title>',
    '',
    '<the real page body in markdown, grounded in the actual transcript content shown above -- no invented specifics>',
    '===END PAGE===',
    '',
    'Apply the PRIVACY RULES above while writing the body. One transcript can produce more than one page (e.g. a live case study AND a separate incident it references) -- repeat the ===PAGE===...===END PAGE=== block for each.',
  ].join('\n');
}

function wikiPagePromotePlanPrompt(task) {
  const ctx = task.promptContext;
  return [
    'This is a final publish confirmation for an already-vetted wiki page candidate -- not a re-draft. The content below was already extracted and approved in an earlier review pass.',
    'Your plan is one line: does this candidate still look correctly formed (real category from the space\'s list, a real title, a non-empty body) and safe to publish as-is?',
    '',
    `Category: ${ctx.category}`,
    `Slug: ${ctx.slug}`,
    `Title: ${ctx.title}`,
    '',
    'Body:',
    '---',
    ctx.markdown,
    '---',
  ].join('\n');
}

function wikiPagePromoteImplementPrompt(task, planText) {
  return [
    planText,
    '',
    'Respond with EXACTLY one of:',
    'CONFIRMED',
    'FLAG-ISSUE: <one short sentence why this should NOT be published as-is>',
    '',
    'Do not rewrite or re-emit the page body -- the real, already-approved content is applied automatically on CONFIRMED.',
  ].join('\n');
}

module.exports = {
  wikiTranscriptExtractPlanPrompt,
  wikiTranscriptExtractImplementPrompt,
  wikiPagePromotePlanPrompt,
  wikiPagePromoteImplementPrompt,
};
