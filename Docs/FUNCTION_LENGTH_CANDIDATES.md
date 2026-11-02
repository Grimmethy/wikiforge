# Function Length Decomposition Candidates

### AC-1 · Decompose Second Brain Tab Orchestration
Strength: Strong
Files: ui/secondbrain-tab.js
Symbol: renderSecondBrainTab
Snippet:
```
  }

  async function renderSecondBrainTab() {
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
      main.innerHTML = `<div class="wikiforge-layout"><h3>SecondBrain</h3>
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
        renderSecondBrainTab();
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
        renderSecondBrainTab();
      };
    }
    const cancelBtn = main.querySelector('[data-wikiforge-cancel-new-page]');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        wikiforgeNewPageOpen = false;
        wikiforgeCreateError = null;
        wikiforgeLastRenderedKey = null;
        renderSecondBrainTab();
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
        renderSecondBrainTab();
      };
    }
  }
```

Problem:
The function orchestrates multiple distinct concerns — fetching and caching templates, fetching categories, rendering page detail, building UI layout, wiring event listeners for sidebar, new page, and toggle controls, and handling form submission with state mutation. Each of these is a logically separable responsibility that could be extracted into its own function. The current structure mixes state updates, DOM manipulation, side-effect wiring, and conditional rendering logic, making it hard to test, debug, or extend without risking unintended side effects. A decomposition would improve testability, readability, and maintainability.

Solution:
Extract `fetchAndCacheTemplates(base)`, `fetchCategories(base, spaceId)`, `renderPageDetail(page)`, `buildSidebarHtml(categories)`, `renderLayout(sidebarHtml, detailHtml)`, `wireSidebarEvents(main)`, `wireToggleEvents(main)`, `wireNewPageForm(form, base)`, and `renderSecondBrainTab()` — each handling one concern. `renderSecondBrainTab()` becomes a thin orchestrator that calls the others in sequence, managing renderKey logic and initial state setup.

Benefits:
Decomposing reduces cognitive load, isolates side effects, enables unit testing of each piece, and makes future changes (e.g., swapping rendering logic or event handlers) safer and more localized.

VERDICT CONSTRAINT:
Genuine
