'use strict';

// Named page templates -- WikiForge's answer to a wiki's hand-built category-grid /
// guide-index hub pages, without needing the volunteer-editor community that keeps
// those from rotting on a 20-year-old game wiki. A template is a starting shape (a
// markdown body skeleton + default typed `fields`) an author -- human or AI-assisted --
// fills in once; the navigational index around it (src/categories.js) stays
// deterministic and can't drift the way a hand-maintained hub page can.
//
// 'home' is not a special case anywhere else in the code -- getHomePage (pages.js)
// just looks for a page at the fixed slug 'home'. This template exists so creating
// that page is a one-click action instead of writing it from scratch.

const TEMPLATES = {
  guide: {
    id: 'guide',
    label: 'Guide',
    description: 'A how-to page: goal, steps, gotchas.',
    fields: { category: 'Guides', type: 'guide' },
    body: (title) => `# ${title}

## Goal

What this guide gets you to.

## Steps

1.
2.
3.

## Gotchas

-
`,
  },
  reference: {
    id: 'reference',
    label: 'Reference',
    description: 'A lookup page: facts, not narrative.',
    fields: { category: 'Reference', type: 'reference' },
    body: (title) => `# ${title}

| Field | Value |
| --- | --- |
|  |  |
`,
  },
  'category-index': {
    id: 'category-index',
    label: 'Category Index',
    description: 'A curated hub page linking out to a set of related pages.',
    fields: { category: 'Indexes', type: 'category-index' },
    body: (title) => `# ${title}

A curated index. Add [[wikilinks]] to the pages this category should highlight.

## Pages in this category

- [[]]
`,
  },
  home: {
    id: 'home',
    label: 'Home / Front Page',
    description: "A space's landing page -- create it at slug \"home\".",
    fields: { category: 'Home', type: 'home' },
    body: (title) => `# ${title}

Welcome. This is the front page of this space.

## Start here

- [[]]
`,
  },
};

function listTemplates() {
  return Object.values(TEMPLATES).map(({ id, label, description }) => ({ id, label, description }));
}

function getTemplate(id) {
  return TEMPLATES[id] || null;
}

/** @returns {{title: string, body: string, fields: object} | null} */
function renderTemplate(id, { title } = {}) {
  const tpl = getTemplate(id);
  if (!tpl) return null;
  const resolvedTitle = title && title.trim() ? title.trim() : tpl.label;
  return { title: resolvedTitle, body: tpl.body(resolvedTitle), fields: { ...tpl.fields } };
}

module.exports = { listTemplates, getTemplate, renderTemplate };
