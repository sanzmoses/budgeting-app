# Budgeting App Monorepo

Multi-user budgeting app. Frontend and backend deploy independently from this single repo.

## Planning docs

- `docs/infrastructure.md` — hosting, domains, deploy paths
- `docs/implementation-plan.md` — product decisions, domain model, phase plan
- `docs/session-handoff.md` — quick-start for resuming work

Additional checkpoint:
- `docs/service-store-refactor-checkpoint-2026-05-02.md` - frontend API/service/store architecture checkpoint

## Repo

- GitHub: `https://github.com/sanzmoses/budgeting-app`

## Stack

- Frontend: React + Vite (`apps/web`)
- Backend: Plain PHP API (`apps/api`)
- Database: MySQL on Hostinger (Phase 1)

## Structure

```
apps/web        React frontend
apps/api        PHP backend API
packages/shared shared code/types (future)
docs            infrastructure and planning notes
secrets         local secret placeholders (not committed)
```

## Frontend API Architecture

Current frontend API flow:

```text
components -> stores -> services -> apiClient -> PHP API
```

- `apps/web/src/lib/apiClient.js` is the only source file expected to call `fetch()` directly.
- Services in `apps/web/src/services/` define endpoint wrappers.
- Stores in `apps/web/src/stores/` own shared data, caching, invalidation, and mutations.
- Components should use store hooks/actions for app data instead of importing services directly.

## Local development

### Prerequisites

- Node.js 18+
- PHP 8.1+ (for the built-in dev server)

### Frontend

```bash
# Install dependencies
npm install

# Start dev server at http://localhost:3000
npm run dev:web

# Production build
npm run build:web
```

### Backend

```bash
cd apps/api

# Copy env example and fill in values as needed
cp .env.example .env

# Start PHP built-in server at http://localhost:8000
# The script exports env vars from .env then starts the server.
./serve.sh

# Or manually:
export $(grep -v '^#' .env | xargs) && php -S localhost:8000 index.php
```

### Database setup

Phase 1 adds a MySQL schema and seed data. Apply them to a fresh database:

```bash
# Create the database in your MySQL instance first, then:
mysql -u <user> -p <dbname> < apps/api/db/schema.sql
mysql -u <user> -p <dbname> < apps/api/db/seed.sql
```

Then fill in the DB values in `apps/api/.env`.
Use `budgeting-app/secrets/database.md` as the source of truth for real budgeting-app values.

Example local shape:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=budgeting
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

> Seed data includes two dev users (`sanz` / `kaye`) with the password `password`.
> Change these before any real use.

### Auth (Phase 2)

Phase 2 adds bearer token auth. After applying the Phase 2 migration (or
running the full schema which includes `auth_tokens`), the following endpoints
are active:

| Endpoint           | Method | Auth required | Description                |
| ------------------ | ------ | ------------- | -------------------------- |
| `/auth/login`      | POST   | No            | Returns bearer token       |
| `/auth/logout`     | POST   | Yes           | Invalidates token          |
| `/auth/me`         | GET    | Yes           | Returns current user       |

**Seed users** (password: `password` for both — change before real use):

| Username | Name |
| -------- | ---- |
| `sanz`   | Sanz |
| `kaye`   | Kaye |

To apply the Phase 2 migration to an existing Phase 1 database:

```bash
mysql -u <user> -p <dbname> < apps/api/db/migrate_phase2.sql
```

Test login locally:
```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"sanz","password":"password"}' | jq .
```

### Transactions (Phase 3)

Phase 3 adds transaction entry. After logging in via the frontend you will see
four tabs: **Expense**, **Income**, **Savings**, and **Transactions**.

The following API endpoints are active (all require a valid `Authorization: Bearer <token>` header):

| Endpoint          | Method | Description                                   |
| ----------------- | ------ | --------------------------------------------- |
| `/bootstrap`      | GET    | Option lists: accounts, categories, subcategories, places, income sources |
| `/transactions`   | POST   | Create expense, income, or transfer            |
| `/transactions`   | GET    | List transactions (default: current month)     |

**Create an expense via curl:**
```bash
TOKEN="<your-token-from-login>"

curl -s -X POST http://localhost:8000/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "expense",
    "transaction_date": "2026-04-23",
    "account_id": 1,
    "category_id": 4,
    "subcategory_id": 13,
    "place_id": 1,
    "amount": 850.00,
    "description": "Weekly grocery run"
  }' | jq .
```

**Create an income entry:**
```bash
curl -s -X POST http://localhost:8000/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "income",
    "transaction_date": "2026-04-23",
    "account_id": 1,
    "income_source_id": 1,
    "amount": 25000.00,
    "description": "April salary"
  }' | jq .
```

**Create a transfer (savings movement):**
```bash
curl -s -X POST http://localhost:8000/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "transfer",
    "transaction_date": "2026-04-23",
    "from_account_id": 1,
    "to_account_id": 2,
    "amount": 3000.00,
    "transfer_label": "Travel"
  }' | jq .
```

**List current-month transactions:**
```bash
curl -s "http://localhost:8000/transactions" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Filter by type:
curl -s "http://localhost:8000/transactions?type=expense" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Different month:
curl -s "http://localhost:8000/transactions?month=2026-04" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Transaction management (Phase 4)

Phase 4 adds edit/delete for transactions and computed account balances.

The following additional API endpoints are active (all require `Authorization: Bearer <token>`):

| Endpoint                    | Method | Description                              |
| --------------------------- | ------ | ---------------------------------------- |
| `/transactions/{id}`        | GET    | Single transaction detail                |
| `/transactions/{id}`        | PUT    | Edit a transaction (type cannot change)  |
| `/transactions/{id}`        | DELETE | Soft-delete a transaction                |
| `/accounts/balances`        | GET    | Computed balances for all active accounts|
| `/accounts/{id}/balance`    | GET    | Computed balance for one account         |

**Get a single transaction:**
```bash
curl -s http://localhost:8000/transactions/1 \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Edit a transaction:**
```bash
curl -s -X PUT http://localhost:8000/transactions/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "transaction_date": "2026-04-23",
    "account_id": 1,
    "category_id": 4,
    "subcategory_id": 13,
    "amount": 900.00,
    "description": "Updated grocery run"
  }' | jq .
```

**Soft-delete a transaction:**
```bash
curl -s -X DELETE http://localhost:8000/transactions/1 \
  -H "Authorization: Bearer $TOKEN"
# Returns 204 No Content on success
```

**Get all account balances:**
```bash
curl -s http://localhost:8000/accounts/balances \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Get one account's balance:**
```bash
curl -s http://localhost:8000/accounts/1/balance \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Budgets (Phase 5)

Phase 5 adds monthly category budgets and budget visibility on the expense form.

Additional API endpoints (all require `Authorization: Bearer <token>`):

| Endpoint                                  | Method | Description |
| ----------------------------------------- | ------ | ----------- |
| `/budgets?month=2026-04`                  | GET    | List monthly budgets with spent/remaining |
| `/budgets/summary?month=2026-04&category_id=4` | GET    | Get one category's month summary |
| `/budgets`                                | POST   | Create or upsert a monthly budget |
| `/budgets/{id}`                           | PUT    | Update a monthly budget |

**List budgets for a month:**
```bash
curl -s "http://localhost:8000/budgets?month=2026-04" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Create or upsert a budget:**
```bash
curl -s -X POST http://localhost:8000/budgets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "month": "2026-04",
    "category_id": 4,
    "amount": 8500.00
  }' | jq .
```

**Update a budget by id:**
```bash
curl -s -X PUT http://localhost:8000/budgets/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 9000.00
  }' | jq .
```

### Health checks

| Endpoint                        | Expected response        |
| ------------------------------- | ------------------------ |
| `http://localhost:3000`         | React app loads          |
| `http://localhost:8000/`        | JSON: app info           |
| `http://localhost:8000/health`  | JSON: `{ status: "ok" }` |

## Environment files

| File                    | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `apps/web/.env.example` | Frontend env template — copy to `.env`     |
| `apps/api/.env.example` | Backend env template — copy to `.env`      |

Only `VITE_*` variables in `apps/web/.env` are exposed to the browser.
Never put backend secrets in the frontend env file.

## Deploy targets

| App      | URL                              | Hostinger root                                              |
| -------- | -------------------------------- | ----------------------------------------------------------- |
| Frontend | `https://budget.sanzmoses.com`   | `/home/u141166830/domains/budget.sanzmoses.com/public_html` |
| API      | `https://budget-api.sanzmoses.com` | `/home/u141166830/domains/budget-api.sanzmoses.com/public_html` |

## Notes

- Keep real secrets out of git. Use `.env` files locally; set env vars in the hosting panel for production.
- For budgeting-app-specific credentials and deploy values, use `secrets/` inside the `budgeting-app/` repo as the source of truth.
- On Hostinger production app config, prefer `DB_HOST=localhost` or `127.0.0.1` instead of the public server IP.
- Frontend and backend deploy independently.
