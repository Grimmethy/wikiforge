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
// (including the dashboard's 5s poll), so state (selectedSlug, expanded categories) is
// kept at module scope, not re-derived each call, and the fetch only refires when
// nothing is selected yet or the selection changes -- otherwise every 5s poll would
// yank focus/scroll away from whatever the user is reading.
//
// The sidebar groups pages by category (src/categories.js's rule, mirrored here in
// plain JS -- see groupIntoCategories below) instead of one flat page list, per the
// real complaint this replaced: a 1,300+ page vault rendered as a single scrolling
// list of dates and "Other" has no way to collapse anything. Each category is a
// native <details> element -- expand/collapse for free, no extra JS, and its open/
// closed state survives a re-render via wikiforgeExpandedKeys below (a plain
// re-render would otherwise reset every <details> to closed on each poll tick).

const WIKIFORGE_SPACE_ID = 'agent-manager';
const HOME_SLUG = 'home';

function wikiforgeBaseUrl() {
  return 'http://' + location.hostname + ':7421';
}

let wikiforgeSelectedSlug = null;
let wikiforgeLastRenderedKey = null;
let wikiforgeExpandedKeys = new Set();
let wikiforgeTemplatesCache = null;
let wikiforgeNewPageOpen = false;
let wikiforgeCreateError = null;

// Mirrors src/categories.js's categoryForPage exactly (see that file for the real-
// vault reasoning: an explicit fields.category wins, else the top-level path segment,
// else "Journal" for a bare date-prefixed slug, else "Uncategorized"). Duplicated here
// because this script runs in the browser with no access to WikiForge's own
// require()-able modules.
const WIKIFORGE_DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}/;

function wikiforgeCategoryFor(page) {
  const explicit = page.fields && typeof page.fields.category === 'string' && page.fields.category.trim();
  if (explicit) return explicit.trim();
  const slashIdx = page.slug.lastIndexOf('/');
  if (slashIdx > 0) return page.slug.slice(0, slashIdx).split('/')[0];
  if (WIKIFORGE_DATE_PREFIX_RE.test(page.slug)) return 'Journal';
  return 'Uncategorized';
}

function wikiforgeDateFor(slug) {
  const m = /(?:^|\/)(\d{4}-\d{2}-\d{2})/.exec(slug);
  return m ? m[1] : null;
}

function groupIntoCategories(pages) {
  const byCategory = new Map();
  for (const page of pages) {
    const category = wikiforgeCategoryFor(page);
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(page);
  }
  return Array.from(byCategory.entries())
    .sort(([a], [b]) => {
      if (a === 'Uncategorized') return 1;
      if (b === 'Uncategorized') return -1;
      return a.localeCompare(b);
    })
    .map(([category, categoryPages]) => ({ category, pages: categoryPages }));
}

function pageLinkHtml(p) {
  const active = p.slug === wikiforgeSelectedSlug ? ' class="wikiforge-active"' : '';
  return `<li><a href="#" data-wikiforge-slug="${escapeAttr(p.slug)}"${active}>${escapeHtml(p.title)}</a></li>`;
}

// The "Journal" category is the one real category likely to contain hundreds of
// date-prefixed entries (matching src/journal.js's own convention) -- it gets a
// second, nested level of <details> grouped by date so it collapses the same way the
// old flat list should have from the start. Every other category is small enough
// (bounded by the vault's own folder structure) to render as a flat list.
function renderCategoryPages(category, pages) {
  if (category !== 'Journal') {
    return `<ul class="wikiforge-page-list">${pages.map(pageLinkHtml).join('')}</ul>`;
  }
  const byDate = new Map();
  const undated = [];
  for (const p of pages) {
    const date = wikiforgeDateFor(p.slug);
    if (!date) {
      undated.push(p);
      continue;
    }
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(p);
  }
  const dateEntries = Array.from(byDate.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const dateHtml = dateEntries
    .map(([date, datePages]) => {
      const key = `catdate:Journal|${date}`;
      const open = wikiforgeExpandedKeys.has(key) ? ' open' : '';
      return `<details class="wikiforge-subcategory" data-wikiforge-toggle-key="${escapeAttr(key)}"${open}>
        <summary>${escapeHtml(date)} (${datePages.length})</summary>
        <ul class="wikiforge-page-list">${datePages.map(pageLinkHtml).join('')}</ul>
      </details>`;
    })
    .join('');
  const undatedHtml = undated.length ? `<ul class="wikiforge-page-list">${undated.map(pageLinkHtml).join('')}</ul>` : '';
  return `${dateHtml}${undatedHtml}`;
}

function renderSidebar(categories) {
  const homeLink = `<div class="wikiforge-home-link"><a href="#" data-wikiforge-slug="${HOME_SLUG}"${
    wikiforgeSelectedSlug === HOME_SLUG ? ' class="wikiforge-active"' : ''
  }>🏠 Home</a></div>`;
  const categoriesHtml = categories
    .map(({ category, pages }) => {
      const key = `cat:${category}`;
      const open = wikiforgeExpandedKeys.has(key) ? ' open' : '';
      return `<details class="wikiforge-category" data-wikiforge-toggle-key="${escapeAttr(key)}"${open}>
        <summary>${escapeHtml(category)} (${pages.length})</summary>
        ${renderCategoryPages(category, pages)}
      </details>`;
    })
    .join('');
  const newPageHtml = wikiforgeNewPageOpen ? renderNewPageForm() : '<button type="button" data-wikiforge-new-page>+ New page</button>';
  return `<div class="wikiforge-sidebar">${homeLink}${newPageHtml}${categoriesHtml}</div>`;
}

function renderNewPageForm() {
  const templates = wikiforgeTemplatesCache || [];
  const options = templates.map((t) => `<option value="${escapeAttr(t.id)}" title="${escapeAttr(t.description)}">${escapeHtml(t.label)}</option>`).join('');
  const errorHtml = wikiforgeCreateError ? `<div class="wikiforge-error">${escapeHtml(wikiforgeCreateError)}</div>` : '';
  return `
    <form class="wikiforge-new-page-form" data-wikiforge-new-page-form>
      <label>Template <select name="templateId">${options}</select></label>
      <label>Title <input name="title" type="text" placeholder="Page title" required></label>
      <label>Slug <input name="slug" type="text" placeholder="folder/my-page-slug" required></label>
      ${errorHtml}
      <button type="submit">Create</button>
      <button type="button" data-wikiforge-cancel-new-page>Cancel</button>
    </form>`;
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

// Mirrors src/templates.js's default fields.category per template -- used only to
// guess which sidebar category to auto-expand right after creating a page, so the
// newly created page is visible without the user having to go hunt for it.
const WIKIFORGE_TEMPLATE_CATEGORY = { guide: 'Guides', reference: 'Reference', 'category-index': 'Indexes', home: 'Home' };

async function wikiforgeCreatePage(base, slug, templateId, title) {
  const r = await fetch(`${base}/api/spaces/${WIKIFORGE_SPACE_ID}/pages/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, title }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error || `${r.status}`);
  }
}

function wikiforgeSlugify(title) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function renderWikiforgeTab() {
  const main = document.getElementById('main');
  const base = wikiforgeBaseUrl();

  if (!wikiforgeTemplatesCache) {
    try {
      wikiforgeTemplatesCache = await fetchJson(`${base}/api/templates`);
    } catch (e) {
      wikiforgeTemplatesCache = [];
    }
  }

  let categories;
  try {
    categories = await fetchJson(`${base}/api/spaces/${WIKIFORGE_SPACE_ID}/categories`);
  } catch (e) {
    main.innerHTML = `<div class="wikiforge-layout"><h3>WikiForge</h3>
      <p>Could not reach WikiForge at <code>${escapeHtml(base)}</code>: ${escapeHtml(e.message)}</p>
      <p>Start it with: <code>scripts/start.sh</code> from the wikiforge repo.</p></div>`;
    return;
  }

  const pageCount = categories.reduce((n, c) => n + c.pages.length, 0);
  const renderKey = `${pageCount}:${wikiforgeSelectedSlug}:${wikiforgeNewPageOpen}:${wikiforgeCreateError}`;
  if (renderKey === wikiforgeLastRenderedKey && main.querySelector('.wikiforge-layout')) return;
  wikiforgeLastRenderedKey = renderKey;

  let detailHtml = '<div class="wikiforge-page-detail"><em>Select a page from the sidebar.</em></div>';
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
      <div style="flex:0 0 280px;max-height:calc(100vh - 160px);overflow:auto">${renderSidebar(categories)}</div>
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

  main.querySelectorAll('[data-wikiforge-toggle-key]').forEach((el) => {
    el.addEventListener('toggle', () => {
      const key = el.dataset.wikiforgeToggleKey;
      if (el.open) wikiforgeExpandedKeys.add(key);
      else wikiforgeExpandedKeys.delete(key);
    });
  });

  const newPageBtn = main.querySelector('[data-wikiforge-new-page]');
  if (newPageBtn) {
    newPageBtn.onclick = () => {
      wikiforgeNewPageOpen = true;
      wikiforgeCreateError = null;
      wikiforgeLastRenderedKey = null;
      renderWikiforgeTab();
    };
  }
  const cancelBtn = main.querySelector('[data-wikiforge-cancel-new-page]');
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      wikiforgeNewPageOpen = false;
      wikiforgeCreateError = null;
      wikiforgeLastRenderedKey = null;
      renderWikiforgeTab();
    };
  }
  const form = main.querySelector('[data-wikiforge-new-page-form]');
  if (form) {
    form.oninput = (ev) => {
      if (ev.target.name === 'title' && !form.elements.slug.dataset.wikiforgeTouched) {
        form.elements.slug.value = wikiforgeSlugify(ev.target.value);
      }
    };
    form.elements.slug.oninput = () => {
      form.elements.slug.dataset.wikiforgeTouched = 'true';
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const templateId = form.elements.templateId.value;
      const title = form.elements.title.value;
      const slug = form.elements.slug.value;
      try {
        await wikiforgeCreatePage(base, slug, templateId, title);
        wikiforgeSelectedSlug = slug;
        wikiforgeNewPageOpen = false;
        wikiforgeCreateError = null;
        wikiforgeExpandedKeys.add(`cat:${WIKIFORGE_TEMPLATE_CATEGORY[templateId] || wikiforgeCategoryFor({ slug, fields: {} })}`);
      } catch (e) {
        wikiforgeCreateError = e.message;
      }
      wikiforgeLastRenderedKey = null;
      renderWikiforgeTab();
    };
  }
}

registerPluginTabRenderer('wikiforge', renderWikiforgeTab);

// A no-op in the browser (module is undefined there); lets the pure, DOM-free helpers
// above get real test coverage in Node -- same pattern as core-ui.js's own
// module.exports guard.
if (typeof module !== 'undefined') {
  module.exports = { groupIntoCategories, wikiforgeCategoryFor, wikiforgeDateFor, wikiforgeSlugify };
}
