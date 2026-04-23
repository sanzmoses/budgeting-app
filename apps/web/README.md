# Web App

React + Vite frontend.

## Local dev

```bash
# From repo root — install all workspaces
npm install

# Start dev server at http://localhost:3000
npm run dev:web

# Build for production
npm run build:web
# Output: apps/web/dist/
```

Or run directly from this directory:

```bash
npm run dev
npm run build
npm run preview
```

## Environment

Copy `.env.example` to `.env` and set values:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_SITE_URL=http://localhost:3000
```

Only `VITE_*` variables are exposed to the browser. Never put backend secrets here.

## Deploy

Build output is in `dist/`. Upload the contents of `dist/` to:

```
/home/u141166830/domains/budget.sanzmoses.com/public_html
```
