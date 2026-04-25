# Phase 7B Checkpoint — PWA + Offline Foundation

Date: 2026-04-25

This checkpoint captures the first production-tested PWA and offline foundation for the budgeting app.

## Summary

The app now has:
- installable PWA groundwork
- branded logo assets and manifest
- service worker registration and shell caching groundwork
- IndexedDB bootstrap cache
- offline transaction create queue for expense, income, and transfer
- queued create sync runner when connection returns
- `client_uuid` idempotency support for transaction create sync
- incremental transaction pull endpoint groundwork on the API

A follow-up frontend patch also fixed issues found during production testing around balances, reports, offline JSON handling, and mobile header display.

## Implemented in this checkpoint

### Frontend / PWA
- Added budgeting app logo assets (`svg` + `png`)
- Added `manifest.webmanifest`
- Added `sw.js`
- Registered service worker in frontend entrypoint
- Added mobile-friendly app metadata/icons

### Offline bootstrap support
- Added IndexedDB via Dexie
- Cached bootstrap data locally after successful fetch
- Added fallback to cached bootstrap when network/API is unavailable
- Added basic online/offline and cache status indicator in header

### Offline transaction create support
- Added local transaction storage in IndexedDB
- Added local sync queue storage
- Expense, income, and transfer forms now queue local creates if the server is unreachable
- Transaction list can show locally saved offline transactions when the server request fails
- Pending sync state is visible in the UI

### Sync foundation
- Added sync runner for pending create actions only
- Added retry handling for failed queue items
- Added queue counts in header status

### Backend/API foundation
- Added migration: `apps/api/db/migrate_phase_offline_client_uuid.sql`
- Added `client_uuid` support to `POST /transactions`
- Added idempotent create behavior by `(created_by_user_id, client_uuid)`
- Transaction responses now include `client_uuid`
- Added incremental pull endpoint:
  - `GET /sync/transactions?since=...`

## Production fixes after first deploy

After deploying and testing in production, these issues were found and fixed:

### Fixed
- balances page broken online because frontend expected `balances` while API returned `accounts`
- reports page broken online because frontend called the wrong endpoint and expected different field names
- offline error states on reports / balances / budgets / accounts showed JSON parse errors when server returned invalid or non-JSON responses
- mobile header updated to show logo only (hide `Budget.` text)
- header sync timestamp shortened for readability

### Added safety helper
- Added shared response parser: `apps/web/src/http.js`
- This avoids raw `Unexpected token ... is not valid JSON` crashes on affected pages

## Deployment notes confirmed in this checkpoint

### Frontend
- Deploy root works via SSH/rsync:
  - `/home/u141166830/domains/budget.sanzmoses.com/public_html`

### Backend
Important deployment lesson confirmed again:
- `budget-api.sanzmoses.com` must be treated carefully because the live-served backend root can behave differently from what SSH path assumptions suggest
- safe default is to ensure the live API root contains its own correct `.env`
- wrong-target symptom is public 404 on `/health` even if files appear present over SSH in a different location

### Production verification completed
- `https://budget-api.sanzmoses.com/health` returned OK after deploy
- `https://budget-api.sanzmoses.com/` returned API metadata
- `https://budget.sanzmoses.com` served the latest built assets successfully
- production testing confirmed the follow-up fixes were good

## Current safe scope

What works now:
- online app continues to function
- app shell / branding / manifest groundwork is in place
- bootstrap data can fall back to cached IndexedDB copy
- offline transaction create queue exists
- queued creates can sync when connection returns
- `client_uuid` reduces duplicate create risk

What is intentionally not done yet:
- offline edit
- offline delete
- full canonical reconciliation of all server changes into local IndexedDB state
- offline-aware balances, budgets, and reports based on local queued data
- full two-way sync UX

## Recommended next step

Next practical milestone:
1. use `/sync/transactions` on the frontend
2. reconcile pulled server transaction changes into IndexedDB
3. then add offline edit/delete after reconciliation is stable

## Related docs
- `docs/offline-pwa-plan.md`
- `docs/session-handoff.md`
- `docs/infrastructure.md`
