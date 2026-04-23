# API App

Plain PHP backend API. No framework — routes handled in `index.php`.

## Local dev

```bash
cd apps/api

# Copy env example
cp .env.example .env
# Edit .env as needed

# Start dev server at http://localhost:8000
./serve.sh

# Or manually:
export $(grep -v '^#' .env | xargs) && php -S localhost:8000 index.php
```

## Endpoints

| Method | Path      | Description              |
| ------ | --------- | ------------------------ |
| GET    | `/`       | API info                 |
| GET    | `/health` | Health check (JSON)      |

More routes will be added in Phase 2+ (auth, transactions, etc.).

## Database setup (Phase 1)

```bash
# Create the database in MySQL first, then apply schema and seed data:
mysql -u <user> -p <dbname> < db/schema.sql
mysql -u <user> -p <dbname> < db/seed.sql
```

Fill in `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in your `.env` file before starting the server.

> Seed data includes two users (`sanz` / `kaye`) with the default password `password`.
> Change these passwords before using in any real environment.

## Structure

```
index.php     main router/bootstrap — all requests land here via .htaccess
config.php    env config loader (reads getenv())
db.php        PDO connection helper — call db() to get the shared PDO instance
db/
  schema.sql  full database schema (tables, indexes, foreign keys)
  seed.sql    initial seed data (users, accounts, categories, subcategories, places, income sources, budgets)
.htaccess     Apache rewrite rules — routes all requests to index.php
serve.sh      dev helper — loads .env and starts php -S
.env.example  env template — copy to .env locally
```

## Deploy

Upload the contents of `apps/api/` to:

```
/home/u141166830/domains/budget-api.sanzmoses.com/public_html
```

Set production env values in the Hostinger panel (do not upload `.env` to production).

## Notes

- Auth is implemented with bearer tokens stored server-side (`auth_tokens` table).
- Keep backend secrets server-side only. Never expose them to the frontend.
