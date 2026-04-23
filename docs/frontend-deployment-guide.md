# Frontend Deployment Guide

This guide covers how to prepare and deploy the budgeting app frontend.

Use together with:
- `docs/infrastructure.md`
- `docs/frontend-guide.md`
- root `README.md`

## Target

- Frontend URL: `https://budget.sanzmoses.com`
- Frontend deploy root: `/home/u141166830/domains/budget.sanzmoses.com/public_html`
- Frontend source: `apps/web`
- Frontend build output: `apps/web/dist`

## Environment

Frontend uses Vite, so only `VITE_*` variables are exposed to the browser.

Production frontend env should include:

```env
VITE_API_BASE_URL=https://budget-api.sanzmoses.com
VITE_SITE_URL=https://budget.sanzmoses.com
```

Do not place backend secrets in frontend env.

## Local production-style build

From repo root:

```bash
npm install
cd apps/web
cp .env.example .env
npm run build
```

Or from repo root:

```bash
npm install
npm run build:web
```

## Pre-deploy checklist

Before deploying frontend:

1. Confirm `VITE_API_BASE_URL` points to the live API domain
2. Confirm backend CORS allows `https://budget.sanzmoses.com`
3. Run a production build successfully
4. Verify `apps/web/dist` was generated
5. Upload only built frontend assets to the frontend deploy root

## Deploy flow

### Option A: manual upload

1. Build frontend from `apps/web`
2. Upload contents of `apps/web/dist/` to:
   - `/home/u141166830/domains/budget.sanzmoses.com/public_html`
3. Overwrite old static assets
4. Reload the site and test login flow

### Option B: SSH/rsync upload

If SSH access is available, sync the built files into the domain-specific public root.

Example shape:

```bash
rsync -av --delete apps/web/dist/ user@host:/home/u141166830/domains/budget.sanzmoses.com/public_html/
```

Use actual host/user details from private secrets, not this example placeholder.

## Post-deploy test list

After deploy, verify:

1. `https://budget.sanzmoses.com` loads
2. No broken JS/CSS asset paths
3. Login form renders
4. Login reaches the live API
5. Authenticated app loads after login
6. Transactions and balances views load correctly

## Common issues

### App loads but login fails
- Check `VITE_API_BASE_URL`
- Check API CORS config
- Check live API health endpoint

### Blank page or missing assets
- Check that `dist/` contents, not the `dist` folder itself, were uploaded correctly
- Check build completed without errors
- Check domain root path is correct

### 404 on refresh or deep links
Current app is simple enough for single-entry static hosting, but if client-side routing is expanded later, add a frontend rewrite/fallback strategy.

## Current recommendation

Deploy frontend only after backend production env and CORS are confirmed, so login and transaction flows work end to end.
