# Service/Store Refactor Checkpoint - 2026-05-02

This checkpoint captures the frontend API architecture refactor completed on
May 2, 2026.

## Summary

The web app now has a centralized request, service, and store flow:

```text
components -> stores -> services -> apiClient -> PHP API
```

The goal is to avoid repeated API calls across components, keep fetched data in
one shared place, and invalidate/refetch only when data changes.

## What Changed

### Central API Client

Added:
- `apps/web/src/lib/apiClient.js`

The singleton `apiClient` now owns:
- API base URL resolution via `VITE_API_BASE_URL`
- bearer token storage for the current browser session
- JSON serialization/parsing
- authorization headers
- shared `ApiError` handling with HTTP status/payload metadata

Only `apiClient` should call `fetch()` directly.

### Service Layer

Added:
- `apps/web/src/services/authService.js`
- `apps/web/src/services/bootstrapService.js`
- `apps/web/src/services/accountService.js`
- `apps/web/src/services/budgetService.js`
- `apps/web/src/services/reportService.js`
- `apps/web/src/services/subcategoryService.js`
- `apps/web/src/services/transactionService.js`

Services are thin API wrappers. They know endpoint paths and request shapes, but
do not own React state.

### Store Layer

Added:
- `apps/web/src/stores/index.jsx`
- `apps/web/src/stores/bootstrapStore.jsx`
- `apps/web/src/stores/accountStore.jsx`
- `apps/web/src/stores/budgetStore.jsx`
- `apps/web/src/stores/reportStore.jsx`
- `apps/web/src/stores/subcategoryStore.jsx`
- `apps/web/src/stores/transactionStore.jsx`

Stores now own shared frontend data and actions:
- bootstrap options, with IndexedDB cache fallback
- accounts and balances
- monthly budgets and budget summaries
- report summaries and category breakdowns
- subcategories
- transaction lists and transaction mutations

Stores cache data by query key where appropriate, prevent duplicate in-flight
loads, and expose invalidation/actions to components.

### Component Cleanup

Updated components now use stores instead of direct `fetch()` calls:
- app/auth shell
- login
- reports
- accounts
- account balances
- budgets
- subcategories
- transaction list
- edit transaction modal
- expense/income/transfer forms

Transaction create forms still preserve offline queue behavior. Network or
connectivity failures can queue local creates; API validation errors are shown
without queuing.

### Offline Sync Update

Offline sync now posts pending queued transactions through `apiClient`, so sync
uses the same auth and error behavior as the rest of the app.

## Important Behavior

- `StoreProvider` wraps the authenticated app shell in `apps/web/src/app/index.jsx`.
- Stored auth tokens are pushed into `apiClient` during app initialization before
  stores mount.
- Logout clears both local storage and the `apiClient` token.
- Store invalidation increments refresh versions so active subscribers refetch.
- Components should not import services for data operations unless there is a
  very narrow reason. Prefer store hooks/actions.

## Current Direct Fetch Rule

As of this checkpoint:
- direct `fetch()` is expected only in `apps/web/src/lib/apiClient.js`
- `apps/web/src/lib/http.js` remains in the repo but is no longer used by the
  refactored screens

## Verification

Completed checks:
- `npm --workspace apps/web run build` passes
- source scan confirms no component-level `fetch()` calls remain
- Vite dev server was started and returned HTTP 200 at `http://127.0.0.1:5173`

## Follow-Up Ideas

- Remove `apps/web/src/lib/http.js` after confirming no older branches still
  need it.
- Consider moving auth logout/me/login fully behind an auth store if auth state
  grows.
- Add focused tests around store invalidation and offline create fallback when a
  test framework is introduced.
