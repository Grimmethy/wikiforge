# Observability Fix Candidates

### AC-1 · Silent Error Swallowing in handleCategoriesRoute
Strength: Strong
Files: src/routes/pages.js
Snippet:
```
  if (!m || req.method !== 'GET') return false;
  try {
    respondJson(res, 200, await pages.listPagesGroupedByCategory(m[1]));
  } catch (err) {
    respondJson(res, 500, { error: err.message });
  }
  return true;
```

Problem:
The `catch` block in `handleCategoriesRoute` silently swallows the error by wrapping it in a 500 response without logging the error to `console.error` or rethrowing it — making it invisible to operators and logs. Since the project has no metrics or logging framework beyond `console.error`, this failure is unobservable and unactionable. If `pages.listPagesGroupedByCategory` throws an unhandled error (e.g., due to a bug or data corruption), it will not surface in logs or telemetry, and the user will only see a generic 500 response — leaving the root cause undetected.

Solution:
Replace the `catch` block with:

```js
catch (err) {
  console.error('Error in handleCategoriesRoute:', err);
  respondJson(res, 500, { error: err.message });
}
```

This logs the error to `console.error` (the only available logging primitive) while still returning the 500 response — ensuring both user experience and operator observability are preserved.

Benefits:
Once fixed, operators can detect and debug failures in `handleCategoriesRoute` via console logs — enabling faster incident response and preventing silent degradation of the service. The fix uses only available primitives and does not require adding metrics or external logging systems.

### AC-2 · Silent 500 Errors Without Logging
Strength: Strong
Files: src/routes/pages.js
Snippet:
```
    const page = await pages.getHomePage(m[1]);
    if (!page) return respondJson(res, 404, { error: 'no home page yet' }), true;
    respondJson(res, 200, page);
  } catch (err) {
    respondJson(res, 500, { error: err.message });
  }
  return true;
```

Problem:
The `catch` block in `handleHomeRoute` emits a 500 response but does not log the error — and since the project has no third-party logging system, the only available primitive is `console.error`. The error is silently swallowed without context, making it impossible to diagnose why a 500 was returned (e.g., database failure, invalid page data). The function contract requires returning `true` on completion, so rethrowing is not an option — but logging is critical for observability.

Solution:
Log the error with message and stack trace using `console.error`, then return `true` to satisfy the function contract. The response is already emitted, so no further action is needed — but logging ensures the error is captured for debugging.

Benefits:
Errors that previously went unlogged (like database failures or invalid page data) will now appear in console logs with full context, enabling faster diagnosis and resolution of 500 responses in production.

### AC-3 · Silent Error Handling in Page Template Creation
Strength: Strong
Files: src/routes/pages.js
Snippet:
```
        try {
          const created = await pages.createPageFromTemplate(spaceId, slug, body.templateId, { title: body.title });
          respondJson(res, 201, created);
        } catch (err) {
          const status = /already exists/.test(err.message) ? 409 : 400;
          respondJson(res, status, { error: err.message });
        }
```

Problem:  
The `try...catch` block around `pages.createPageFromTemplate(...)` silently catches and rethrows an error with a status code and message, but does not log the error for observability. In a production environment, this means that failures (e.g., database errors, template resolution failures, or validation errors) are not recorded in logs, making debugging and monitoring impossible. The error is also not rethrown — it’s consumed and returned as a status response — which may mask real system failures.

Solution:  
Log the error with sufficient context (spaceId, slug, templateId) before responding, and rethrow if needed (though in this case, since the response is already constructed, logging is sufficient for observability hygiene). Since the project has no metrics system, we log to stderr using `console.error` (as this is Node.js code).

Benefits:  
Once fixed, failures during template-based page creation will be logged with context, enabling observability and debugging without altering behavior. The system will no longer silently swallow errors — even if they are handled gracefully — making it easier to detect and respond to real-world failures.
