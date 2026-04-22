# Budgeting App Monorepo

Infrastructure-first scaffold for a budgeting app with separate frontend and backend deploy targets.

## Repo

- GitHub: `https://github.com/sanzmoses/budgeting-app`

## Stack

- Frontend: React
- Backend: PHP + MySQL

## Structure

- `apps/web` — React frontend
- `apps/api` — PHP backend API
- `packages/shared` — shared code/types/docs if needed
- `docs` — infrastructure and deployment notes
- `secrets` — local secret placeholders and private setup references

## Notes

- Keep real secrets out of Git if this repo will be pushed.
- Use the example env files as templates.
- Frontend and backend can deploy independently from this single repo.
- PHP backend and React frontend can still live cleanly in one repo.
