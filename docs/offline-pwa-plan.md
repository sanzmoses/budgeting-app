# Offline PWA Plan

This document defines the practical rollout plan for adding installable mobile PWA support and offline-first behavior to the budgeting app.

## Current stack

- Frontend: React + Vite (`apps/web`)
- Backend: plain PHP API (`apps/api`)
- Database: MySQL
- Current state: login, transactions, balances, budgets, accounts, subcategories, reports groundwork in progress, initial PWA shell groundwork added

## Goals

- Make the web app installable on mobile as a PWA
- Allow the app shell to load offline
- Allow users to keep working with unstable or no internet
- Save changes locally first, then sync to the API when back online
- Start with the highest-value offline flow first: **transactions**

## Non-goals for v1

- Full offline support for every feature from day one
- Complex multi-device merge resolution UX
- Perfect real-time cross-device consistency
- Background sync that depends on browser-specific advanced APIs
- Native mobile app packaging

## Recommended rollout

### Phase A — PWA shell and installability

Goal: app can be installed and reopened with cached shell assets.

Scope:
- manifest
- icons
- service worker
- cache app shell/assets
- install metadata and theme color

Success criteria:
- app is installable on supported mobile browsers
- returning users can reopen the shell while offline
- branding/icons display correctly

### Phase B — Read-only offline bootstrap cache

Goal: previously loaded reference data is available offline.

Scope:
- cache bootstrap/reference data in IndexedDB
- store last successful bootstrap payload locally
- load cached bootstrap when API is unreachable

Reference data to cache first:
- accounts
- categories
- subcategories
- income sources
- places
- current user profile if needed for shell rendering

Success criteria:
- forms can still render option lists when offline
- app shows clear "offline cached data" state

### Phase C — Offline transaction creation with sync queue

Goal: user can create transactions offline and sync later.

Scope:
- write new transactions into IndexedDB immediately
- add a sync queue entry per offline change
- show pending/synced/failed state in UI
- replay queued actions when back online

Start with:
- expense create
- income create
- transfer create

Success criteria:
- user can create transactions with no connection
- created rows appear in local transaction list immediately
- queued items sync successfully once online

### Phase D — Offline transaction edit/delete

Goal: existing local/server transactions can be changed while offline.

Scope:
- local edits update IndexedDB first
- local deletes mark as pending delete
- queue preserves operation order per entity

Success criteria:
- edited/deleted records reconcile cleanly after reconnect
- no duplicate transactions are created by sync retries

### Phase E — Expand offline support to settings and budgets

Scope:
- accounts
- subcategories
- monthly budgets
- selected report cache if useful

This should happen only after transactions are stable offline.

## Data model approach

Use an **offline-first local store** in IndexedDB.

Rules:
- UI reads from local IndexedDB-backed state where practical
- writes happen locally first
- sync pushes changes to server afterward
- server remains source of truth after successful reconciliation

## Recommended libraries

### Frontend
- **Dexie** for IndexedDB wrapper
- **uuid** for client-generated IDs
- optional later: **vite-plugin-pwa** for richer PWA/service worker workflow

Why:
- Dexie keeps IndexedDB code manageable
- UUIDs let offline-created records exist before the server sees them
- Vite plugin can improve cache/version management later, but a custom service worker is fine initially

## IndexedDB schema proposal

Suggested database name: `budgeting-app`

### Tables / stores

#### `meta`
General app metadata.

Suggested records:
- `lastBootstrapSyncAt`
- `lastTransactionSyncAt`
- `lastSuccessfulSyncAt`
- `currentUser`
- `schemaVersion`

#### `bootstrap_cache`
Cached lookup/reference data.

Suggested shape:
- `key` — e.g. `bootstrap`
- `payload` — full bootstrap response
- `syncedAt`

#### `transactions`
Local transaction records used by the UI.

Suggested fields:
- `id` — client UUID used as primary identifier
- `serverId` — nullable until confirmed by API if legacy numeric IDs still exist
- `transactionDate`
- `type`
- `description`
- `amount`
- `accountId`
- `toAccountId`
- `categoryId`
- `subcategoryId`
- `incomeSourceId`
- `placeId`
- `createdByUserId`
- `updatedAtLocal`
- `updatedAtServer`
- `syncStatus` — `synced | pending_create | pending_update | pending_delete | failed`
- `isDeletedLocal`
- `syncError`

Indexes to consider:
- `transactionDate`
- `type`
- `syncStatus`
- `[transactionDate+type]`

#### `sync_queue`
Ordered list of local operations waiting to be sent.

Suggested fields:
- `id` — queue item UUID
- `entityType` — e.g. `transaction`
- `entityId` — local entity UUID
- `action` — `create | update | delete`
- `payload`
- `attemptCount`
- `status` — `pending | syncing | failed`
- `createdAt`
- `lastAttemptAt`
- `errorMessage`

#### Optional later stores
- `accounts`
- `budgets`
- `subcategories`

For v1, these can remain inside cached bootstrap payload instead of separate normalized stores.

## Identity strategy

For offline sync, prefer **client-generated UUIDs** for new records.

Recommended direction:
- add a nullable `client_uuid` column to `transactions` on the backend
- frontend generates UUID on create
- sync requests send this UUID
- server uses it for idempotent create behavior
- keep existing rows as `NULL`; no backfill is required for the first offline milestone

Why this matters:
- prevents duplicate creates during retries
- allows local records to exist before API response returns
- simplifies matching local and server records

## Sync queue design

Use a simple serialized queue for v1.

### Queue behavior
- process items in creation order
- one sync runner at a time
- stop or back off on repeated failures
- retry when:
  - app regains connectivity
  - user reopens app
  - user manually taps retry/sync

### Operation rules
- offline create → add local transaction + queue `create`
- offline update on pending create → update local row and replace queued create payload if possible
- offline update on synced row → queue `update`
- offline delete on pending create → remove local row and drop queued create
- offline delete on synced row → mark local row deleted and queue `delete`

### Idempotency
API requests should support safe retry.

Minimum safe behavior:
- create by `client_uuid` should not duplicate rows
- update/delete should be no-op safe when request is repeated

## Backend API changes needed

The current PHP API is request/response oriented for online use. For offline sync, it needs a few additions.

## Minimum backend changes for v1

### 1. Transaction client UUID support
Add a stable client identifier to transactions.

Suggested DB addition:
- `client_uuid CHAR(36) NULL`
- unique constraint on `(created_by_user_id, client_uuid)`

### 2. Create transaction endpoint accepts client UUID
`POST /transactions`

Add/accept:
- `client_uuid`
- optional `updated_at_client`

Behavior:
- if `client_uuid` already exists for the authenticated user, return existing/canonical record instead of creating duplicate

### 3. Update/delete endpoints should return canonical row state
Current update/delete routes should consistently return enough state for local reconciliation.

Recommended:
- update returns updated row with server timestamps
- delete returns success with deleted id/client_uuid

### 4. Pull changes endpoint
Add a way to refresh local state incrementally.

Suggested endpoint:
- `GET /sync/transactions?since=ISO_TIMESTAMP`

Status:
- initial endpoint added in the API for incremental transaction pull

Returns:
- created/updated transactions since timestamp
- deleted transaction identifiers if soft deletes are used
- server sync timestamp

### 5. Optional push endpoint later
For v2 or after create/update/delete flow is stable, consider:
- `POST /sync/push`
- `GET /sync/pull`

For v1, existing transaction endpoints plus a pull endpoint are enough.

## Conflict strategy for v1

Keep this simple.

Recommended rule:
- **last write wins**, based on server `updated_at`

Additional guardrails:
- if server row changed after local cache and before offline update sync, accept server resolution and mark local item as conflicted only if the payload differs materially
- log/display a lightweight warning for failed reconciliation rather than building a full merge UI

Practical v1 approach:
- detect conflict
- keep server state as canonical
- mark local item with warning/toast
- allow user to reapply changes manually if needed

## UI states and indicators

Offline features fail when the UI is ambiguous. Show state clearly.

### Global indicators
- `Offline`
- `Online`
- `Syncing…`
- `Last synced: <time>`
- `Pending changes: <count>`

### Record-level indicators
For transaction rows:
- pending create
- pending update
- pending delete
- failed sync

### UX behaviors
- on save while offline: confirm with message like `Saved locally. Will sync when online.`
- on sync failure: show `Could not sync 1 change. Tap to retry.`
- provide manual retry action
- do not block the whole app because one queue item failed

## Suggested frontend implementation order

### Step 1
Create local data layer:
- `src/lib/db.js` or `src/lib/offline-db.js`
- Dexie schema
- helper methods for bootstrap cache and transactions

### Step 2
Create online status + sync status store:
- navigator online/offline listeners
- simple sync manager hook/context

### Step 3
Cache bootstrap locally:
- on successful `/bootstrap`, save local copy
- on fetch failure, read cached bootstrap

### Step 4
Implement offline transaction create:
- ExpenseForm
- IncomeForm
- TransferForm
- TransactionList reads merged local data

### Step 5
Add queue processor:
- run on app load
- run on reconnect
- run after successful login if pending queue exists

### Step 6
Add edit/delete support offline

## Risks

- existing backend transaction IDs may not be ideal for offline-first identity without `client_uuid`
- transaction list currently fetches directly from API, so local-first reads will require refactoring
- browser storage can be cleared by users/system policies
- service worker cache bugs can create stale UI if versioning is sloppy
- sync edge cases increase quickly once edits/deletes are included

## Recommended v1 boundaries

Do this first:
- installable shell
- cached bootstrap
- offline transaction create
- queue sync on reconnect
- basic status indicators

Do not do yet:
- budgets offline editing
- reports full offline computation
- accounts/subcategories full offline CRUD
- complex merge center UI
- background sync dependent on unsupported browser behavior

## Definition of done for first offline milestone

The first real offline milestone is successful when:
- user can install the app on mobile
- user can open the app shell without internet
- user can load cached lookup data offline
- user can create expense/income/transfer transactions offline
- those changes appear immediately in the UI
- queued changes sync correctly once internet returns
- duplicate creates are prevented by client UUID handling
