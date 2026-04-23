# Budgeting App Frontend Guide

Project-specific frontend and UI guide for the budgeting app.

## Current implementation (Phase 5 UI refresh — 2026-04-23)

The UI was redesigned with an **IDE-like dark-first design language** inspired by VS Code:

- **Dark default** with light mode toggle (stored in `localStorage` under `budget_theme`)
- **Sharp corners** (no border radius), flat surfaces, minimal shadow
- **CSS custom properties** drive all theming — see `:root` and `[data-theme="light"]` blocks in `App.css`
- **Desktop layout**: fixed sidebar (200 px) + top header (48 px) + scrollable main area
- **Mobile layout**: top header + scrollable content + fixed bottom nav (60 px)
- **Mobile bottom nav**: 4 primary items + "More" popup for overflow (Balances, Budgets)
- **Form rows stack** on mobile (≤ 768 px) via `flex-direction: column` on `.form-row`
- **Avatar dropdown** (top-right): dark/light toggle + sign out
- **Login page**: header + left sidebar panel (desktop), simplified single-column (mobile)
- **lucide-react** added for nav icons (PlusCircle, TrendingUp, ArrowLeftRight, List, Wallet, BarChart2, MoreHorizontal, Moon, Sun, LogOut, ChevronRight)

Palette references VS Code dark: `#1e1e1e` base, `#252526` surface, `#007acc` accent.

---

## Product direction (long-term vision)

The budgeting app should feel like a premium futuristic dark dashboard.

Design target:
- modular dashboard landing page
- card-based layout
- neo-minimal sci-fi mood
- glassmorphism meets soft neumorphism
- cinematic depth with subtle glow and shadow
- polished, clean, slightly experimental

## Visual identity

### Palette mood
Use a moody cinematic palette built around:
- deep navy
- charcoal
- teal
- cyan
- coral
- magenta
- warm orange

### Visual style rules
- dark matte background
- large rounded rectangles
- soft inner shadows
- ambient glow
- subtle gradients instead of flat fills
- minimal thin typography with strong readability
- lots of negative space
- elegant micro-detail lines and dots
- premium concept/Dribbble-like finish
- abstract details only when they do not hurt usability

## Experience goals
Users should feel:
- calm
- focused
- in control
- visually impressed without being overwhelmed

The UI should still remain practical for real budgeting tasks.

## Layout rules

### 1) Card-based composition
Prefer dashboards and forms made of cards.

Examples:
- balance overview card
- spending trend card
- income summary card
- recent transactions card
- quick action card
- monthly goals card

### 2) Large soft containers
- Use generous border radius.
- Prefer large rounded cards over sharp blocks.
- Keep spacing breathable.

### 3) Depth, not clutter
- Use soft shadows, inner shadows, subtle borders, and glow.
- Avoid noisy effects.
- Effects should support hierarchy, not distract.

### 4) Strong information hierarchy
Important financial numbers should stand out through:
- scale
- contrast
- spacing
- restrained accent color

## Component architecture

Follow modular composition strictly.

### Forms
A card form should usually be split like this:

```text
TransactionFormCard/
  index.tsx
  fields/
    AmountField.tsx
    DateField.tsx
    AccountField.tsx
    CategoryField.tsx
    NotesField.tsx
  actions/
    SubmitButton.tsx
    ResetButton.tsx
```

### Dashboard sections
```text
DashboardPage/
  index.tsx
  sections/
    HeroSection/
      index.tsx
      cards/
        BalanceCard/
        CashflowCard/
    InsightsSection/
      index.tsx
      cards/
        SpendingTrendCard/
        CategoryBreakdownCard/
    ActivitySection/
      index.tsx
      cards/
        RecentTransactionsCard/
```

## Recommended project structure

For the React frontend in `apps/web`, prefer something like:

```text
apps/web/src/
  pages/
    Dashboard/
      index.tsx
      sections/
        HeroSection/
          index.tsx
          cards/
            NetWorthCard/
              index.tsx
              fields/
                MainValue.tsx
                DeltaValue.tsx
            MonthlyBudgetCard/
              index.tsx
        InsightsSection/
          index.tsx
          cards/
            ExpenseBreakdownCard/
              index.tsx
            IncomeVsExpenseCard/
              index.tsx
        ActivitySection/
          index.tsx
          cards/
            RecentTransactionsCard/
              index.tsx
              rows/
                TransactionRow.tsx
    Transactions/
      index.tsx
      sections/
        FilterSection/
        ListSection/
  components/
    ui/
    layout/
    feedback/
  hooks/
  lib/
  styles/
  theme/
```

Adjust for the actual router/framework, but keep the same mental model.

## Styling system guidance

### Tokens
Create and reuse tokens for:
- background layers
- surface gradients
- text hierarchy
- accent colors
- border colors
- shadow/glow levels
- radius sizes
- spacing scale

### Suggested token intent
- `bg-base`: darkest matte background
- `bg-elevated`: main card background
- `bg-glass`: translucent elevated surface
- `accent-cyan`: high-tech highlights
- `accent-teal`: calm positive emphasis
- `accent-coral`: warm attention state
- `accent-magenta`: expressive highlight
- `accent-orange`: premium warmth / important callout

## Motion and effects
- Keep motion subtle and smooth.
- Prefer soft hover lift, glow shift, and opacity transitions.
- Avoid dramatic movement for finance workflows.
- Micro-interactions should feel premium, not playful.

## Typography
- Keep type clean and modern.
- Prefer thin-to-regular weight combinations.
- Preserve contrast on dark surfaces.
- Large numeric values should be especially legible.

## Data visualization guidance
If charts are used:
- keep them minimal and elegant
- avoid noisy chart chrome
- use accent colors sparingly
- ensure labels remain readable on dark backgrounds
- favor clean line/area/bar visuals over heavy decoration

## Practical guardrails
- Fancy visuals must never reduce readability.
- Form usability beats aesthetic experimentation.
- A beautiful dashboard that is annoying to use is a bad budgeting UI.
- Keep inputs obvious, accessible, and easy to scan.

## Build bias for this app
Default to these choices unless there is a good reason not to:
- dark cinematic dashboard foundation
- modular card-driven sections
- separate field components
- tree-based page folders
- tokenized styles
- subtle gradient surfaces
- soft glow and inner depth
- clean, premium, maintainable implementation
