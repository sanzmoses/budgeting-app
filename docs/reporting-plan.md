# Reporting Page Plan

This document defines the agreed first implementation scope for the budgeting app reporting page.

## Goal

Add a mobile-friendly reporting page that helps users quickly understand:
- total income
- total expenses
- total savings
- expense breakdown by category

The first version should prioritize clarity and speed over complexity.

## Agreed Decisions

- Reporting should be available as a dedicated **Reports** tab in the frontend.
- Reports should support two views:
  - **Daily**
  - **Monthly**
- Default selections:
  - **Daily** defaults to **today**
  - **Monthly** defaults to **current month**
- Users should not see an overwhelming all-time report by default.
- Users can change the date or month manually using picker controls.
- For now, **savings** in reports means **all transfer transactions**.
- Mobile-friendliness is a hard requirement from the start.

## Product Scope: Phase 7A

Phase 7A should deliver the first usable reporting page.

### Included
- New **Reports** tab in the app shell
- Period toggle: **Daily / Monthly**
- Date picker for daily view
- Month picker for monthly view
- Summary cards for:
  - Income
  - Expense
  - Savings
  - Net (recommended, derived)
- Main summary chart for the selected period
- Expense category breakdown section
- Expense breakdown list below the chart
- Mobile-first responsive layout

### Deferred to later reporting phases
- Multi-month trend charts
- Previous-period comparison
- Subcategory drilldown
- Budget vs actual reporting panel
- Account movement reporting
- Export/download
- Advanced filters

## UX Recommendation

## Overall layout

### 1. Report controls
At the top of the page:
- segmented control: `Daily | Monthly`
- period picker:
  - daily => date input
  - monthly => month input

Behavior:
- When opening the page, default to monthly current month or daily today. Either is acceptable, but monthly is likely more useful as the initial default.
- Switching between Daily and Monthly keeps the UI simple and only shows the relevant picker.

### 2. Summary cards
Show a compact grid of cards:
- Income
- Expense
- Savings
- Net

Definitions:
- **Income** = sum of `transactions.amount` where `type = income`
- **Expense** = sum of `transactions.amount` where `type = expense`
- **Savings** = sum of `transactions.amount` where `type = transfer`
- **Net** = `income - expense`

Notes:
- Net should probably exclude transfers because transfers are internal movement, not net wealth change.
- Savings is still shown separately because it is important to the user's workflow and mental model.

### 3. Main chart
For the first version, use a simple chart that works well on mobile.

Recommended chart:
- **vertical bar chart** with 3 bars:
  - Income
  - Expense
  - Savings

Reasoning:
- easy to read on small screens
- low implementation complexity
- no overloaded legend or multi-series trend logic yet

### 4. Expense category breakdown
Below the summary chart:
- show **expense by category** for the selected date/month
- recommended visualization: **horizontal bar chart**

Why horizontal bars:
- category names fit better on small screens
- easier to compare amounts quickly
- avoids cramped rotated labels

### 5. Breakdown list
Under the category chart, include a plain list:
- category name
- amount
- optional percentage of total expense

This gives a fallback for readability and accessibility.

## Mobile-First Requirements

The reporting page must be designed for mobile from the beginning.

### Rules
- no tables for core reporting content
- avoid dense legends and multi-line axis clutter
- stack cards vertically or in a 2-column grid on small screens
- keep controls thumb-friendly
- keep charts compact and readable
- always provide text/list equivalents under charts

### Responsive behavior
- On mobile:
  - controls stack vertically
  - summary cards use 2 columns or 1 column depending on width
  - charts take full width
- On desktop:
  - controls can align horizontally
  - cards can use 4 columns
  - category list can remain below chart for consistency

## Backend API Plan

The current `/transactions` endpoint returns raw rows and is not ideal as the long-term reporting API.

To keep the frontend simple and efficient, Phase 7A should add dedicated report endpoints.

## Proposed routes

### Summary route
`GET /reports/summary`

Supported query params:
- `period=daily&date=YYYY-MM-DD`
- `period=monthly&month=YYYY-MM`

Example response:

```json
{
  "period": "monthly",
  "month": "2026-04",
  "income_total": 25000,
  "expense_total": 12000,
  "savings_total": 3000,
  "net_total": 13000
}
```

### Expense breakdown route
`GET /reports/expenses-by-category`

Supported query params:
- `period=daily&date=YYYY-MM-DD`
- `period=monthly&month=YYYY-MM`

Example response:

```json
{
  "period": "monthly",
  "month": "2026-04",
  "expense_total": 12000,
  "categories": [
    {
      "category_id": 4,
      "category_name": "Food",
      "amount": 4200,
      "percentage": 35
    },
    {
      "category_id": 2,
      "category_name": "Bills",
      "amount": 3800,
      "percentage": 31.67
    }
  ]
}
```

## Query logic

### Daily filters
- `transaction_date = selected date`

### Monthly filters
- `transaction_date >= YYYY-MM-01`
- `transaction_date <= last day of month`

### Summary aggregation
- income total: sum where `type = 'income'`
- expense total: sum where `type = 'expense'`
- savings total: sum where `type = 'transfer'`
- net total: `income total - expense total`

### Category aggregation
- only use rows where `type = 'expense'`
- group by `category_id`
- join `categories` table for names
- order by amount descending

## Frontend Implementation Plan

## New component
Recommended new component:
- `apps/web/src/ReportsPage.jsx`

Possible helpers if needed:
- `apps/web/src/reporting.js`
- lightweight chart helpers or inline SVG components

## App shell changes
Update `AppShell.jsx`:
- add `reports` to `NAV_ITEMS`
- render `ReportsPage` in main content area
- place the tab in both desktop sidebar and mobile overflow/nav structure

## State model inside ReportsPage
Recommended local state:
- `mode` => `'monthly' | 'daily'`
- `selectedMonth`
- `selectedDate`
- `summary`
- `categoryBreakdown`
- `loading`
- `error`

## Data loading behavior
- on first load, fetch default period data
- on mode change, fetch new data for current selection
- on picker change, refetch relevant data
- summary and breakdown can be fetched in parallel

## Chart implementation recommendation
Because the current frontend is intentionally lightweight and has no chart dependency yet, Phase 7A should start with one of these approaches:

### Option A — preferred for MVP
Use **custom lightweight charts with plain divs/CSS or inline SVG**.

Pros:
- no extra dependency
- full styling control
- easier to keep mobile-friendly
- enough for simple bar charts

### Option B
Add a small chart library later if needed.

Recommendation:
- start with custom bars for Phase 7A
- only add a chart library if the reporting UI becomes more advanced

## Suggested UI sections in ReportsPage

### Report header
- title: `Reports`
- short helper text if needed

### Controls card
- mode toggle
- date/month picker

### Summary cards section
- 4 cards with strong numeric display

### Summary chart card
- 3-bar chart for Income / Expense / Savings

### Expense breakdown card
- horizontal category bars
- category list with values and optional percentages

## Example frontend flow

### Monthly mode
User opens Reports:
- mode defaults to monthly
- selected month defaults to current month
- page loads summary + expense breakdown for that month

### Daily mode
User switches to Daily:
- selected date defaults to today
- page reloads summary + expense breakdown for that date

## Suggested SQL shapes

### Summary query concept
Use conditional aggregation:

```sql
SELECT
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income_total,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense_total,
  COALESCE(SUM(CASE WHEN type = 'transfer' THEN amount ELSE 0 END), 0) AS savings_total
FROM transactions
WHERE deleted_at IS NULL
  AND transaction_date >= ?
  AND transaction_date <= ?
```

### Expense category breakdown query concept

```sql
SELECT
  c.id AS category_id,
  c.name AS category_name,
  COALESCE(SUM(t.amount), 0) AS amount
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.deleted_at IS NULL
  AND t.type = 'expense'
  AND t.transaction_date >= ?
  AND t.transaction_date <= ?
GROUP BY c.id, c.name
ORDER BY amount DESC, c.name ASC
```

Percentages can be computed in PHP after total expense is known.

## Delivery Sequence

### Phase 7A.1
Backend first:
- add report helper functions
- add `/reports/summary`
- add `/reports/expenses-by-category`
- validate inputs for daily and monthly periods

### Phase 7A.2
Frontend shell integration:
- add Reports tab
- add empty ReportsPage scaffold
- wire loading, error, and picker state

### Phase 7A.3
Frontend report UI:
- summary cards
- summary bar chart
- category breakdown bars/list
- responsive styling

### Phase 7A.4
Manual verification
- test daily today values
- test month switching
- test empty states
- test no-data periods
- test mobile layout

## Acceptance Criteria

Phase 7A is complete when:
- Reports tab exists and loads successfully
- Daily mode works with a date picker
- Monthly mode works with a month picker
- Summary cards show income, expense, savings, and net
- Savings includes all transfer transactions
- Expense category breakdown is shown for the selected period
- The page is usable and readable on mobile
- Empty periods do not break the UI

## Future Enhancements

Possible next steps after Phase 7A:
- previous-day / previous-month comparison
- budget vs actual summary by category
- subcategory breakdown drilldown
- trends across recent months
- account-based charts
- export/report download
