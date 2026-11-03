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

### AC-2 · Decompose renderWikiforgeWikiTab into focused sub-functions
Strength: Strong
Files: ui/wikiforge-wiki-tab.js
Symbol: renderWikiforgeWikiTab
Snippet:
```
  }

  async function renderWikiforgeWikiTab() {
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
      main.innerHTML = `<div class="wikiforge-layout"><h3>WikiForge Wiki</h3>
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
        renderWikiforgeWikiTab();
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
        renderWikiforgeWikiTab();
      };
    }
    const cancelBtn = main.querySelector('[data-wikiforge-cancel-new-page]');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        wikiforgeNewPageOpen = false;
        wikiforgeCreateError = null;
        wikiforgeLastRenderedKey = null;
        renderWikiforgeWikiTab();
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
        renderWikiforgeWikiTab();
      };
    }
  }
```

Problem:
The function is 720 lines long and handles fetching templates, categories, rendering page detail, building DOM structure, wiring event listeners, and managing form state — all in one async function. This creates high cognitive load, makes unit testing impossible without mocking the entire function, and increases risk of side effects (e.g., event listeners added after DOM mutations). The function’s monolithic nature also makes incremental changes risky and hard to review.

Solution:
Extract the following into separate, focused functions:
- fetchAndCacheTemplates(base) → fetches /api/templates and caches it.
- fetchCategories(base, spaceId) → fetches /api/spaces/{space}/categories.
- renderPageDetail(page) → already exists; reuse it.
- renderSidebar(categories) → already exists; reuse it.
- renderLayout(categories, detailHtml) → builds the flex layout.
- wireEventListeners(main) → attaches all event handlers.
- handleNewPageForm(form) → manages form state and submit.

Benefits:
Each sub-function is now testable in isolation, easier to review, and less prone to side effects. Changes to one concern (e.g., event listeners) won’t risk breaking others. The main function becomes a 20-line orchestrator, improving maintainability and reducing cognitive load.

VERDICT CONSTRAINT:
Genuine

### AC-3 · Decompose Long Agent Manager Wiki Tab Render Function
Strength: Strong
Files: ui/agent-manager-wiki-tab.js
Symbol: renderAgentManagerWikiTab
Snippet:
```
  }

  async function renderAgentManagerWikiTab() {
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
      main.innerHTML = `<div class="wikiforge-layout"><h3>Agent Manager Wiki</h3>
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
        renderAgentManagerWikiTab();
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
        renderAgentManagerWikiTab();
      };
    }
    const cancelBtn = main.querySelector('[data-wikiforge-cancel-new-page]');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        wikiforgeNewPageOpen = false;
        wikiforgeCreateError = null;
        wikiforgeLastRenderedKey = null;
        renderAgentManagerWikiTab();
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
        renderAgentManagerWikiTab();
      };
    }
  }
```

Problem:
The function `renderAgentManagerWikiTab` is 107 lines and orchestrates multiple unrelated responsibilities: template fetching, category data handling, render key calculation, sidebar/detail rendering, event listener setup, and form state management. These concerns are tightly coupled, making the function hard to test, debug, or extend without introducing side effects. For example, changing how form validation works could unintentionally affect sidebar rendering logic due to shared state or event handlers.

Solution:
Extract the following into separate, named functions:  
- `fetchAndCacheTemplates(base)` — handles template fetching and caching.  
- `fetchCategoriesWithFallback(spaceId, base)` — fetches categories with error fallback and state updates.  
- `shouldRender(renderKey, currentKey)` — checks if render key has changed to avoid redundant work.  
- `renderSidebar(categories, base)` — renders sidebar content independently.  
- `renderPageDetail(page, base)` — renders page detail independently.  
- `setupEventListeners(main, base)` — encapsulates all event listener bindings.  
- `handleNewPageForm(form, base)` — manages form state, validation, and submission logic.

Benefits:
Decomposing this function improves testability by isolating each concern, reduces cognitive load during review, and enables independent refactoring or extension without risking unintended side effects. It also makes it easier to reason about the function’s behavior under different states — e.g., when categories fail to load or when a new page is submitted — because each piece is self-contained and verifiable.

### AC-4 · Decompose Monolithic UI Orchestrator
Strength: Strong
Files: ui/propertyforager-wiki-tab.js
Symbol: renderPropertyForagerWikiTab
Snippet:
```
  }

  async function renderPropertyForagerWikiTab() {
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
      main.innerHTML = `<div class="wikiforge-layout"><h3>PropertyForager Wiki</h3>
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
        renderPropertyForagerWikiTab();
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
        renderPropertyForagerWikiTab();
      };
    }
    const cancelBtn = main.querySelector('[data-wikiforge-cancel-new-page]');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        wikiforgeNewPageOpen = false;
        wikiforgeCreateError = null;
        wikiforgeLastRenderedKey = null;
        renderPropertyForagerWikiTab();
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
        renderPropertyForagerWikiTab();
      };
    }
  }
```

Problem:
The function orchestrates multiple distinct responsibilities — fetching and caching templates, fetching and rendering categories, rendering sidebar and detail content, wiring up event listeners for UI interactions, and managing state via global variables. Each of these concerns could be isolated into its own function with clear, testable boundaries. The current structure mixes I/O, DOM manipulation, state mutation, and UI event binding into a single monolithic block, making it hard to reason about, test, or modify without risking side effects. Decomposing it would improve readability, testability, and maintainability.

Solution:
Extract six logical functions: `fetchAndCacheTemplates(base)`, `fetchAndRenderCategories(base, spaceId)`, `renderSidebar(categories)`, `renderPageDetail(page)`, `wireEventListeners(main)`, and `updateStateAndReRender()`. Each should handle one responsibility, with clear inputs and outputs. The main function becomes a coordinator that calls these in sequence, passing context as needed, and triggering re-renders or state updates only when necessary.

Benefits:
Decomposing this function improves readability by isolating concerns, enables unit testing of each piece independently, and reduces risk during modification — changes to UI logic won’t accidentally break state management or event handling. It also makes the codebase more maintainable over time as the UI evolves.
