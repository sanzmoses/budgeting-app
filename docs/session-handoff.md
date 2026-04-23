# Budgeting App Session Handoff

Use this file to resume work quickly in a future session.

## Current state

- Phase 0 complete — React + Vite frontend scaffold, PHP API scaffold, health endpoints
- Phase 1 complete — MySQL schema, seed data, PHP DB connection helper
- Phase 2 complete — bearer token auth, login/logout/me endpoints, frontend login flow
- Phase 3 complete — transaction entry (expense/income/transfer), transaction list, bootstrap endpoint
- Phase 4 complete — transaction edit/delete, computed account balances, balances tab
- Phase 5 complete — monthly budgets CRUD, spent-this-month calculation, remaining-budget display on expense form
- Phase 6 started — accounts CRUD/settings UI added; account delete now requires typed confirmation and removes related transactions
- Phase 6 continued — subcategories CRUD/settings UI added (create + update)

## Read first

1. `README.md`
2. `docs/infrastructure.md`
3. `docs/implementation-plan.md`

## Agreed decisions

- Multi-user app
- Username + password login
- Savings modeled internally as transfer between accounts
- Monthly budgets at category level for MVP
- Account balances computed from ledger transactions
- Web-first MVP
- Reports later
- Mobile later
- Offline later

## Phase status

| Phase | Name                      | Status      |
| ----- | ------------------------- | ----------- |
| 0     | Project setup             | Complete    |
| 1     | Database foundation       | Complete    |
| 2     | Auth                      | Complete    |
| 3     | Transaction creation      | Complete    |
| 4     | Transaction mgmt/balances | Complete    |
| 5     | Budgets                   | Complete    |
| 6     | Settings management       | Not started |
| 7     | Reports                   | Deferred    |

## Phase 2 — what was completed

Files added:
- `apps/api/auth.php` — `generate_token()`, `get_bearer_token()`, `auth_user()`, `require_auth()`
- `apps/api/db/migrate_phase2.sql` — adds `auth_tokens` table to an existing Phase 1 DB
- `apps/web/src/LoginForm.jsx` — login form component
- `apps/web/src/AppShell.jsx` — authenticated app shell with user name + sign out

Files modified:
- `apps/api/db/schema.sql` — added `auth_tokens` table definition
- `apps/api/index.php` — added `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `apps/web/src/App.jsx` — auth state management; shows LoginForm or AppShell
- `apps/web/src/App.css` — login form and user bar styles
- `README.md` — auth setup, seed user notes, curl example
- `apps/api/.env.example` — clarified JWT_SECRET comment

Auth approach:
- Random 32-byte token generated with `random_bytes`, hex-encoded
- SHA-256 hash stored in `auth_tokens` — raw token never persisted
- Tokens expire after 30 days; logout deletes the row
- `require_auth()` in `auth.php` can be called at the top of any protected route

To apply Phase 2 to an existing database:
```bash
mysql -u <user> -p <dbname> < apps/api/db/migrate_phase2.sql
```

Phase 2 checks (all pass):
- Valid login returns a usable bearer token ✓
- Invalid credentials return 401 ✓
- `GET /auth/me` without token returns 401 ✓
- Logout invalidates the token server-side ✓
- Frontend shows login form when unauthenticated ✓
- Frontend shows app shell + user name when authenticated ✓
- Stored token is verified on page load; invalid/expired tokens are cleared ✓

## Phase 3 — what was completed

Files added:
- `apps/api/` — `GET /bootstrap`, `POST /transactions`, `GET /transactions` routes in `index.php`
- `apps/web/src/ExpenseForm.jsx` — expense entry form
- `apps/web/src/IncomeForm.jsx` — income entry form
- `apps/web/src/TransferForm.jsx` — transfer/savings entry form
- `apps/web/src/TransactionList.jsx` — current-month transaction list with type filter and month picker

Files modified:
- `apps/api/index.php` — added 3 new routes; bumped version to 0.3.0 / phase 3
- `apps/web/src/AppShell.jsx` — replaced placeholder with tabbed shell (Expense / Income / Savings / Transactions)
- `apps/web/src/App.css` — tab bar, form, and transaction list styles
- `README.md` — Phase 3 curl examples and endpoint table
- `docs/session-handoff.md` — phase status updated

Transaction entry approach:
- Single `POST /transactions` endpoint accepts `type` (expense/income/transfer) and validates required fields per type
- `GET /bootstrap` returns all option lists in one call; loaded once by AppShell and passed down as props
- `GET /transactions` defaults to current month; supports `?month=YYYY-MM` and `?type=` query params
- All three routes require a valid bearer token

Phase 3 checks:
- Expense creates correctly with account, category, subcategory ✓
- Income creates correctly with account and income source ✓
- Transfer validates that from/to accounts differ ✓
- All routes reject requests without a valid bearer token ✓
- Transaction list shows newly created rows ✓

## Phase 4 — what was completed

Files added:
- `apps/web/src/EditTransactionModal.jsx` — modal form for editing transactions (type-specific fields, pre-populated)
- `apps/web/src/AccountBalances.jsx` — displays computed balances for all active accounts

Files modified:
- `apps/api/index.php` — added 5 new routes; bumped version to 0.4.0 / phase 4; added `fetch_transaction()` and `compute_account_balance()` helpers
- `apps/web/src/TransactionList.jsx` — added Edit and Del buttons per row; edit opens modal; delete confirms then soft-deletes; accepts `bootstrap` and `onChanged` props
- `apps/web/src/AppShell.jsx` — added Balances tab; passes `bootstrap` down to TransactionList; unified `handleDataChanged` keeps balances in sync after create/edit/delete; bumped phase badge to Phase 4
- `apps/web/src/App.css` — added modal styles, action button styles, balance panel styles
- `README.md` — Phase 4 curl examples and endpoint table

New API routes (all auth-protected):
- `GET /transactions/{id}` — single transaction detail (not deleted)
- `PUT /transactions/{id}` — edit transaction; type cannot change; same per-type validation as POST; sets `updated_by_user_id`
- `DELETE /transactions/{id}` — soft-delete (sets `deleted_at = NOW()`); returns 204
- `GET /accounts/balances` — computed balances for all active accounts
- `GET /accounts/{id}/balance` — computed balance for one account

Balance formula: `opening_balance + income − expenses + transfers_in − transfers_out` (soft-deleted rows excluded).

Edit behavior:
- Transaction type is immutable (edit form shows fields for the existing type only)
- Same field-level validation as POST applies
- Transfer edits still require different from/to accounts

Phase 4 checks:
- `GET /transactions/{id}` returns 404 for deleted or missing rows ✓
- `PUT /transactions/{id}` updates the row and returns the updated record ✓
- `DELETE /transactions/{id}` sets deleted_at; row no longer appears in list queries ✓
- Balance reflects updated and deleted transactions correctly ✓
- Transfer edits enforce different from/to accounts ✓
- Edit modal pre-populates with existing values ✓
- Delete confirmation prevents accidental deletes ✓
- Balances tab auto-refreshes after create/edit/delete ✓

## Phase 5 — what was completed

Goal completed: planning budgets are now connected to expense entry.

Files added:
- `apps/web/src/BudgetManager.jsx` — month-based budget management UI for all categories

Files modified:
- `apps/api/index.php` — added budget helpers and routes; bumped version to 0.5.0 / phase 5
- `apps/web/src/ExpenseForm.jsx` — added category budget summary card (budget/spent/remaining)
- `apps/web/src/AppShell.jsx` — added Budgets tab and bumped phase badge to Phase 5
- `apps/web/src/App.css` — added budget summary and budget manager styles
- `docs/implementation-plan.md` — phase status updated
- `docs/session-handoff.md` — phase status updated
- `apps/api/README.md` — auth note corrected

New API routes (all auth-protected):
- `GET /budgets?month=YYYY-MM` — list monthly budgets with spent and remaining
- `GET /budgets/summary?month=YYYY-MM&category_id={id}` — category budget summary for expense form
- `POST /budgets` — create or upsert a monthly budget for one category
- `PUT /budgets/{id}` — update a monthly budget amount

Phase 5 behavior:
- Budgets are stored per category per month
- Expense form now loads the selected category's budget summary for the chosen transaction month
- Budget remaining auto-reflects saved expense changes because spent is computed from the ledger
- Budgets tab allows month switching and per-category set/update actions

Phase 5 checks verified on production:
- Correct total spent shown per category per month ✓
- Remaining budget updates after new/edited/deleted expense ✓
- Month switching works correctly ✓
- Live login, budgets tab, and budget create/update flow confirmed ✓
- Production API aligned to budgeting-app source-of-truth DB secrets ✓

## Next phase: Phase 6 — settings management

## Rule for future sessions

Do not start broad implementation without checking the current phase and
validation checklist first.
