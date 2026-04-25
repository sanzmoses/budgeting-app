# Budgeting App Implementation Plan

This document captures the agreed planning decisions before implementation starts.

## Status

- Phase 0 complete — infrastructure, scaffold, health endpoints
- Phase 1 complete — MySQL schema, seed data, PHP DB connection helper
- Phase 2 complete — bearer token auth, login/logout/me endpoints, frontend login flow
- Phase 3 complete — transaction entry (expense/income/transfer), transaction list, bootstrap endpoint
- Phase 4 complete — transaction edit/delete, soft-delete, computed account balances, balances tab
- Phase 5 complete — monthly budgets CRUD, spent-this-month calculation, remaining-budget display on expense form
- Phase 6 in progress — accounts settings CRUD started, including guarded delete confirmation and cascading transaction cleanup
- Phase 6 now also includes subcategories CRUD/settings UI (create + update; inactive filtering supported via bootstrap)
- This document is the source of truth for implementation planning.
- Implementation should proceed in phases and each phase should be testable before continuing.

## Confirmed Stack

- Frontend: React + Vite
- Backend: plain PHP API
- Database: MySQL on Hostinger
- Repo style: monorepo
- Deploy targets:
  - frontend: `https://budget.sanzmoses.com`
  - API: `https://budget-api.sanzmoses.com`

## Product Direction

- Multi-user app
- Web-first MVP
- Mobile later
- Offline support later
- Simple login, but with individual user accounts
- Reports are needed, but can come later

## Core Clarifications

### Budget model
For MVP, monthly budgets are set at the category level.

Example:
- Food = PHP 8,000 for April
- Bills = PHP 12,000 for April

All expense entries under the same category count against that month's category budget.

This is intentionally simpler than subcategory-level budgeting.
Subcategory-level budgets can be added later if needed.

### Account balance model
Account balances should be derived from the transaction ledger, not maintained as an editable "current balance" field.

Current balance should be computed from:
- opening balance
- plus income into the account
- minus expenses from the account
- minus transfers out
- plus transfers in

This keeps balances consistent and traceable.

### Savings model
In the UI, the tab can still be called "Savings" if that feels natural.
Internally, savings movements should be modeled as transfers between accounts.

Example:
- from account: BPI Main
- to account: BPI Travel 3224
- amount: PHP 3,000
- label: Travel

## Confirmed Functional Decisions

- Multi-user: yes
- Login: simple login with username + password
- Savings: yes, but implemented as tracked transfers between accounts
- Monthly budgets: yes
- Reports: later phase
- Web app first: yes

## Recommended MVP Scope

### Included in MVP
- Login
- Expense entry
- Income entry
- Savings/transfer entry
- Transaction list
- Edit/delete transaction
- Account management
- Category budget management
- Settings for categories, subcategories, places, income sources, accounts, users
- Budget visibility on expense form
- Account balance calculation from ledger

### Deferred until later
- Advanced reports
- Charts
- Notifications
- React Native app
- Full offline sync
- Recurring transactions
- Role-based permission system beyond a simple shared-access model

## Domain Model

## Users
Each person should have their own login.

Suggested fields:
- id
- name
- username
- password_hash
- is_active
- created_at

## Accounts
Represents real money containers.

Suggested fields:
- id
- name
- type
- opening_balance
- currency
- is_active
- sort_order
- created_at

Examples:
- BPI Buffer 6888
- BPI Travel 3224

## Categories
Top-level expense groupings.

Suggested examples:
- bills
- allowance
- ministry
- food

Suggested fields:
- id
- name
- is_active
- sort_order

## Subcategories
Child values under a category.

Examples:
- bills -> electricity, water, insurance, house, internet
- allowance -> school, personal, family, maintenance, health
- ministry -> tithes, offering
- food -> grocery, eat-out

Suggested fields:
- id
- category_id
- name
- is_active
- sort_order

## Places
Suggested fields:
- id
- name
- is_active
- sort_order

Examples:
- ulas
- arakan
- deca

## Income Sources
Suggested fields:
- id
- name
- is_active
- sort_order

Examples:
- kaye
- sanz

## Monthly Budgets
For MVP, budgets are category-based and month-based.

Suggested fields:
- id
- budget_month
- category_id
- amount
- created_by_user_id
- created_at
- updated_at

## Transactions
Use one ledger-style transactions table, not separate tables for expense, income, and savings.

Suggested fields:
- id
- transaction_date
- type (`expense`, `income`, `transfer`)
- description
- amount
- created_by_user_id
- updated_by_user_id
- created_at
- updated_at
- deleted_at nullable (optional if soft delete is desired)

Expense-related nullable fields:
- account_id
- category_id
- subcategory_id
- place_id

Income-related nullable fields:
- account_id
- income_source_id

Transfer-related nullable fields:
- from_account_id
- to_account_id
- transfer_label

## Business Rules

### Expense
- Deducts from one selected account
- Requires date, category, subcategory, amount, account
- Place can be required if the team decides it is important enough for all expense entries
- Shows current month's category budget, spent amount, and remaining amount

### Income
- Adds to one selected account
- Requires date, description, amount, source, destination account

### Transfer
- Represents savings movement between accounts
- Deducts from source account
- Adds to destination account
- Source and destination accounts must be different

## UX / Screen Plan

## Authentication
- Login screen
- Fields: username, password

## Main app
Landing page should be optimized for fast entry.
Recommended tabs:
- Expense
- Income
- Savings
- Transactions
- Settings

Internally, the savings tab uses transfer logic.

## Transactions screen
- Current month list by default
- Filter by type
- Filter by account
- Edit transaction
- Delete transaction

## Settings screen
Subsections:
- Accounts
- Budgets
- Categories
- Subcategories
- Places
- Income sources
- Users

## Reports screen
Deferred until later.

## API Direction

API should be simple and practical for the MVP.
Suggested high-level routes:

### Auth
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Transactions
- `GET /transactions`
- `POST /transactions`
- `GET /transactions/{id}`
- `PUT /transactions/{id}`
- `DELETE /transactions/{id}`

### Accounts
- `GET /accounts`
- `POST /accounts`
- `PUT /accounts/{id}`
- `GET /accounts/{id}/balance`

### Budgets
- `GET /budgets?month=YYYY-MM`
- `POST /budgets`
- `PUT /budgets/{id}`

### Settings resources
- `GET /categories`
- `POST /categories`
- `PUT /categories/{id}`
- `GET /subcategories`
- `POST /subcategories`
- `PUT /subcategories/{id}`
- `GET /places`
- `POST /places`
- `PUT /places/{id}`
- `GET /income-sources`
- `POST /income-sources`
- `PUT /income-sources/{id}`
- `GET /users`
- `POST /users`
- `PUT /users/{id}`

## Auth Recommendation
Because the frontend and API are on separate subdomains, token-based auth is recommended for MVP simplicity.

Suggested approach:
- login returns bearer token
- frontend stores token
- protected API routes validate token

Alternative approaches like cookie-based auth can be considered later if needed.

## Phase Plan

## Phase 0 - project setup
Goal:
- confirm and document product rules
- scaffold real web app and API app
- prepare local dev flow

Deliverables:
- React app scaffold in `apps/web`
- PHP API scaffold in `apps/api`
- environment setup
- shared documentation updated
- basic health endpoints

Checks:
- web app runs locally
- API responds locally
- env config is documented

## Phase 1 - database foundation
Goal:
- establish database schema and seed data

Deliverables:
- SQL schema or migrations
- seed data for users, accounts, categories, subcategories, places, income sources
- opening balance support

Checks:
- schema can be applied cleanly
- sample seed data loads successfully
- core tables match planning docs

## Phase 2 - auth
Goal:
- enable simple multi-user login

Deliverables:
- login endpoint
- password hashing
- token generation/validation
- frontend login flow
- protected routes

Checks:
- valid login works
- invalid login is rejected
- protected endpoints require auth

## Phase 3 - transaction creation
Goal:
- create the main workflows

Deliverables:
- expense form
- income form
- transfer/savings form
- transaction creation API
- transaction list API

Checks:
- expense creates correctly
- income creates correctly
- transfer creates correctly
- values persist correctly in DB

## Phase 4 - transaction management + balances
Goal:
- manage records and verify money movement logic

Deliverables:
- transaction list page
- edit transaction
- delete transaction
- computed account balances

Checks:
- editing updates computed balances correctly
- deleting updates computed balances correctly
- transfer logic affects both accounts correctly

## Phase 5 - budgets
Goal:
- connect planning budgets to expense entry

Deliverables:
- monthly budget CRUD
- spent-this-month calculation
- remaining-budget display on expense form

Checks:
- correct total spent is shown per category per month
- remaining budget updates after new expense
- month switching works correctly

## Phase 6 - settings management
Goal:
- allow maintenance of app configuration data

Deliverables:
- accounts management UI
- categories management UI
- subcategories management UI
- places management UI
- income sources management UI
- users management UI

Checks:
- settings updates reflect in forms
- inactive items no longer appear where they should not

## Phase 7 - reports
Planned.

Phase 7A scope is now defined in `docs/reporting-plan.md`.

Phase 7A deliverables:
- Reports tab in the frontend
- Daily and Monthly report modes
- Default today/current-month reporting views with picker controls
- Summary cards for income, expense, savings, and net
- Summary chart for the selected period
- Expense category breakdown chart/list
- Mobile-friendly reporting layout
- Dedicated API endpoints for report summaries and expense-by-category breakdown

Agreed reporting rule for the first version:
- Savings in reports should count **all transfer transactions**.

Possible later deliverables after Phase 7A:
- multi-period trends
- previous-period comparison
- subcategory drilldown
- budget utilization views
- account movement summary

## Test Strategy By Phase
Each phase should have its own verification checklist before moving on.

Minimum testing style:
- manual functional check for UI workflows
- API endpoint verification
- database verification for critical writes
- regression check for balances and budgets after changes

## Session Handoff Notes
When resuming in another session:
1. Read this document first
2. Read `docs/infrastructure.md`
3. Check repo status
4. Implement only the current phase unless scope is intentionally expanded
5. After each phase, update this file or add a phase-specific progress note

## Open Questions To Confirm During Implementation
- Should all users see all transactions? Current recommendation: yes
- Should all users be allowed to edit/delete any transaction in MVP? Current recommendation: yes
- Should expense `place` be required? To confirm during UI implementation
- Should soft delete be used for transactions? Yes — `deleted_at` nullable column added in Phase 1.
- Should income description remain free text or be partially standardized? To confirm during form implementation

## Recommended Next Step
Phase 7A — reporting. Implement the dedicated report endpoints first, then add the Reports tab and mobile-friendly reporting UI described in `docs/reporting-plan.md`.
