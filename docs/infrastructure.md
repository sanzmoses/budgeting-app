# Budgeting App Infrastructure

## Repo Strategy

- Repo type: monorepo
- GitHub repo: `https://github.com/sanzmoses/budgeting-app`
- Deploy targets:
  - frontend app from `apps/web`
  - backend API from `apps/api`
- Shared code location: `packages/shared`

## Stack

- Frontend: React + Vite
- Backend: plain PHP + MySQL

## Hosting Map

### Frontend
- Hostinger site name: `budget`
- Domain/subdomain: `budget.sanzmoses.com`
- Hosting type: `shared`
- Static hosting friendly: yes
- Build command: `npm run build` (expected)
- Output directory: `dist` (expected for Vite)
- Remote deploy root: `/home/u141166830/domains/budget.sanzmoses.com/public_html`
- Access methods available: SSH, FTP

### Backend API
- Hostinger site name: `budget api`
- Domain/subdomain: `budget-api.sanzmoses.com`
- Hosting type: `shared`
- PHP version: `8.3.30`
- Public document root: `/home/u141166830/domains/budget-api.sanzmoses.com/public_html`
- API base path: `/`
- MySQL database name: `u141166830_budgetingapp`
- Access methods available: SSH, FTP
- Routing via `.htaccess`: yes

## GitHub
- Repo name: `sanzmoses/budgeting-app`
- Default branch: to confirm
- Deployment branch strategy: to confirm
- Protected branches: to confirm

## Environments

### Local
- frontend env file: `apps/web/.env.example`
- backend env file: `apps/api/.env.example`

### Production
- frontend production vars stored in hosting panel/build environment
- backend production vars stored in hosting panel or server config
- DB credentials stored privately and never committed

## Domain Plan
- frontend url: `https://budget.sanzmoses.com`
- api url: `https://budget-api.sanzmoses.com`
- CORS origin(s): `https://budget.sanzmoses.com`
- cookie/session domain rules: to confirm

## Deployment Flow

### Frontend
1. Push to GitHub
2. Build React frontend from `apps/web`
3. Deploy generated frontend assets from `apps/web/dist`
4. Upload to `/home/u141166830/domains/budget.sanzmoses.com/public_html`

### Backend
1. Push to GitHub
2. Deploy PHP files from `apps/api`
3. Upload to `/home/u141166830/domains/budget-api.sanzmoses.com/public_html`
4. Configure production env values
5. Connect MySQL
6. Verify API endpoint/health route

## Access Checklist
- [x] GitHub repo created
- [ ] Local repo initialized and connected to remote
- [x] Frontend Hostinger access confirmed
- [x] Backend Hostinger access confirmed
- [x] Domain/subdomain DNS confirmed via server layout
- [x] Frontend build/deploy path confirmed
- [x] Backend PHP document root confirmed
- [x] MySQL credentials added

## Notes
- Never place backend secrets in frontend env.
- For React/Vite, only expose client-safe variables.
- Keep credentials out of tracked docs.
- Keep PHP API config server-side only.
- Account-level `~/public_html` is for another site; use the domain-specific `~/domains/.../public_html` paths for this app.
