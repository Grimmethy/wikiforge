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
