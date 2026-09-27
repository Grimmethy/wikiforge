'use strict';

// WikiForge's dashboard tab -- agent-manager's manifest-driven dashboard-tab mechanism
// (docs/PLUGIN_API.md "Dashboard tab" in agent-manager). Unlike the PromptForge/
// ScriptForge companions, this renders WikiForge's data NATIVELY (real HTML built from
// the real JSON response) rather than iframing WikiForge's own UI -- WikiForge has no
// UI of its own to iframe; it's a headless JSON API, and native rendering is exactly
// the Outline-style embedding principle the design brain dump (bd-1790485555882) chose
// over a widget/iframe. That means this script fetches WikiForge directly, cross-
// origin from the dashboard's own port -- src/server.js sets CORS headers for exactly
// this. registerPluginTabRenderer('wikiforge', ...) below is called every render cycle
// (including the dashboard's 5s poll), so state (selectedSlug) is kept at module scope,
// not re-derived each call, and the fetch only refires when nothing is selected yet or
// the selection changes -- otherwise every 5s poll would yank focus/scroll away from
// whatever the user is reading.

const WIKIFORGE_SPACE_ID = 'agent-manager';

function wikiforgeBaseUrl() {
  return 'http://' + location.hostname + ':7421';
}

let wikiforgeSelectedSlug = null;
let wikiforgeLastRenderedKey = null;

function renderJournalList(journalEntries, otherPages) {
  const journalHtml = journalEntries
    .map(
      (entry) => `
        <div class="wikiforge-journal-date">${escapeHtml(entry.date)}</div>
        <ul class="wikiforge-page-list">
          ${entry.pages
            .map(
              (p) => `<li><a href="#" data-wikiforge-slug="${escapeAttr(p.slug)}">${escapeHtml(p.title)}</a></li>`,
            )
            .join('')}
        </ul>`,
    )
    .join('');
  const otherHtml = otherPages.length
    ? `<div class="wikiforge-journal-date">Other pages</div>
       <ul class="wikiforge-page-list">
         ${otherPages
           .map((p) => `<li><a href="#" data-wikiforge-slug="${escapeAttr(p.slug)}">${escapeHtml(p.title)}</a></li>`)
           .join('')}
       </ul>`
    : '';
  return `<div class="wikiforge-journal">${journalHtml}${otherHtml}</div>`;
}

function renderPageDetail(page) {
  const backlinksHtml = page.backlinks.length
    ? `<div class="wikiforge-backlinks"><strong>Linked from:</strong> ${page.backlinks
        .map((slug) => escapeHtml(slug))
        .join(', ')}</div>`
    : '<div class="wikiforge-backlinks"><em>No backlinks yet.</em></div>';
  return `
    <div class="wikiforge-page-detail">
      <h3>${escapeHtml(page.title)}</h3>
      ${backlinksHtml}
      <div class="wikiforge-page-body">${renderReportMarkdown(page.body)}</div>
    </div>`;
}

// Groups a flat page list by the vault's own date-prefix convention
// (2026-09-26-some-slug), newest first -- mirroring src/journal.js's buildJournal
// server-side, done here in plain JS since this tab has no access to WikiForge's own
// require()-able modules across the browser boundary.
function groupJournal(pages) {
  const DATE_RE = /(?:^|\/)(\d{4}-\d{2}-\d{2})/;
  const byDate = new Map();
  const other = [];
  for (const page of pages) {
    const m = DATE_RE.exec(page.slug);
    if (!m) {
      other.push(page);
      continue;
    }
    if (!byDate.has(m[1])) byDate.set(m[1], []);
    byDate.get(m[1]).push(page);
  }
  const entries = Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, entryPages]) => ({ date, pages: entryPages }));
  return { entries, other };
}

async function renderWikiforgeTab() {
  const main = document.getElementById('main');
  const base = wikiforgeBaseUrl();

  let pages;
  try {
    pages = await fetchJson(`${base}/api/spaces/${WIKIFORGE_SPACE_ID}/pages`);
  } catch (e) {
    main.innerHTML = `<div class="wikiforge-layout"><h3>WikiForge</h3>
      <p>Could not reach WikiForge at <code>${escapeHtml(base)}</code>: ${escapeHtml(e.message)}</p>
      <p>Start it with: <code>WIKIFORGE_SECOND_BRAIN_ROOT=&lt;vault&gt; node src/server.js</code>
      from the wikiforge repo.</p></div>`;
    return;
  }

  const renderKey = `${pages.length}:${wikiforgeSelectedSlug}`;
  if (renderKey === wikiforgeLastRenderedKey && main.querySelector('.wikiforge-layout')) return;
  wikiforgeLastRenderedKey = renderKey;

  const { entries, other } = groupJournal(pages);

  let detailHtml = '<div class="wikiforge-page-detail"><em>Select a page from the journal.</em></div>';
  if (wikiforgeSelectedSlug) {
    try {
      const page = await fetchJson(`${base}/api/spaces/${WIKIFORGE_SPACE_ID}/pages/${encodeURIComponent(wikiforgeSelectedSlug)}`);
      detailHtml = renderPageDetail(page);
    } catch (e) {
      detailHtml = `<div class="wikiforge-page-detail"><em>Could not load page: ${escapeHtml(e.message)}</em></div>`;
    }
  }

  main.innerHTML = `
    <div class="wikiforge-layout" style="display:flex;gap:16px;align-items:flex-start">
      <div style="flex:0 0 260px;max-height:calc(100vh - 160px);overflow:auto">${renderJournalList(entries, other)}</div>
      <div style="flex:1;max-height:calc(100vh - 160px);overflow:auto">${detailHtml}</div>
    </div>`;

  main.querySelectorAll('[data-wikiforge-slug]').forEach((el) => {
    el.onclick = (ev) => {
      ev.preventDefault();
      wikiforgeSelectedSlug = el.dataset.wikiforgeSlug;
      wikiforgeLastRenderedKey = null;
      renderWikiforgeTab();
    };
  });
}

registerPluginTabRenderer('wikiforge', renderWikiforgeTab);
