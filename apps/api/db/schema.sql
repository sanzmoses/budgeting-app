-- =============================================================================
-- Budgeting App — Database Schema
-- Phase 1
--
-- Apply to a fresh database:
--   mysql -u <user> -p <dbname> < apps/api/db/schema.sql
--
-- Character set: utf8mb4 throughout for full Unicode support.
-- Amounts stored as DECIMAL(12,2) — supports up to 9,999,999,999.99.
-- Soft delete on transactions via deleted_at (nullable timestamp).
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    name             VARCHAR(100)     NOT NULL,
    username         VARCHAR(50)      NOT NULL,
    password_hash    VARCHAR(255)     NOT NULL,
    is_active        TINYINT(1)       NOT NULL DEFAULT 1,
    created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- auth_tokens
-- Stores bearer tokens for authenticated sessions.
-- token_hash is SHA-256 of the raw token; raw token is never stored.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_tokens (
    id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    user_id      INT UNSIGNED  NOT NULL,
    token_hash   VARCHAR(64)   NOT NULL,
    created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at   TIMESTAMP     NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_auth_tokens_hash (token_hash),
    KEY idx_auth_tokens_user_id (user_id),
    KEY idx_auth_tokens_expires_at (expires_at),
    CONSTRAINT fk_auth_tokens_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    name             VARCHAR(100)     NOT NULL,
    type             VARCHAR(50)      NOT NULL DEFAULT 'checking'
                         COMMENT 'e.g. checking, savings, cash, credit',
    opening_balance  DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
    currency         CHAR(3)          NOT NULL DEFAULT 'PHP',
    is_active        TINYINT(1)       NOT NULL DEFAULT 1,
    sort_order       INT              NOT NULL DEFAULT 0,
    created_at       TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_accounts_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    name             VARCHAR(100)     NOT NULL,
    is_active        TINYINT(1)       NOT NULL DEFAULT 1,
    sort_order       INT              NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    KEY idx_categories_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- subcategories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subcategories (
    id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    category_id      INT UNSIGNED     NOT NULL,
    name             VARCHAR(100)     NOT NULL,
    is_active        TINYINT(1)       NOT NULL DEFAULT 1,
    sort_order       INT              NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    KEY idx_subcategories_category_id (category_id),
    KEY idx_subcategories_is_active (is_active),
    CONSTRAINT fk_subcategories_category
        FOREIGN KEY (category_id) REFERENCES categories (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS places (
    id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    name             VARCHAR(100)     NOT NULL,
    is_active        TINYINT(1)       NOT NULL DEFAULT 1,
    sort_order       INT              NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    KEY idx_places_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- income_sources
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS income_sources (
    id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    name             VARCHAR(100)     NOT NULL,
    is_active        TINYINT(1)       NOT NULL DEFAULT 1,
    sort_order       INT              NOT NULL DEFAULT 0,

    PRIMARY KEY (id),
    KEY idx_income_sources_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- monthly_budgets
-- One row per category per calendar month.
-- budget_month is stored as the first day of the month (e.g. 2026-04-01).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_budgets (
    id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    budget_month         DATE          NOT NULL
                             COMMENT 'First day of the month, e.g. 2026-04-01',
    category_id          INT UNSIGNED  NOT NULL,
    amount               DECIMAL(12,2) NOT NULL,
    created_by_user_id   INT UNSIGNED  NOT NULL,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_budget_month_category (budget_month, category_id),
    KEY idx_monthly_budgets_month (budget_month),
    CONSTRAINT fk_monthly_budgets_category
        FOREIGN KEY (category_id) REFERENCES categories (id),
    CONSTRAINT fk_monthly_budgets_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- transactions
-- Single ledger table for expense, income, and transfer rows.
-- Nullable columns are used for the fields that only apply to a given type:
--   expense  : account_id, category_id, subcategory_id, place_id
--   income   : account_id, income_source_id
--   transfer : from_account_id, to_account_id, transfer_label
-- deleted_at supports soft delete (NULL = not deleted).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    transaction_date     DATE          NOT NULL,
    type                 ENUM('expense','income','transfer') NOT NULL,
    description          VARCHAR(255)  NULL,
    amount               DECIMAL(12,2) NOT NULL,

    -- shared: expense and income both post to/from one account
    account_id           INT UNSIGNED  NULL,

    -- expense only
    category_id          INT UNSIGNED  NULL,
    subcategory_id       INT UNSIGNED  NULL,
    place_id             INT UNSIGNED  NULL,

    -- income only
    income_source_id     INT UNSIGNED  NULL,

    -- transfer only
    from_account_id      INT UNSIGNED  NULL,
    to_account_id        INT UNSIGNED  NULL,
    transfer_label       VARCHAR(100)  NULL,

    -- audit
    created_by_user_id   INT UNSIGNED  NOT NULL,
    updated_by_user_id   INT UNSIGNED  NULL,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
    deleted_at           TIMESTAMP     NULL DEFAULT NULL,

    PRIMARY KEY (id),
    KEY idx_txn_date        (transaction_date),
    KEY idx_txn_type        (type),
    KEY idx_txn_deleted_at  (deleted_at),
    KEY idx_txn_account_id  (account_id),
    KEY idx_txn_from_account (from_account_id),
    KEY idx_txn_to_account   (to_account_id),
    KEY idx_txn_category_id  (category_id),

    CONSTRAINT fk_txn_account
        FOREIGN KEY (account_id)       REFERENCES accounts (id),
    CONSTRAINT fk_txn_category
        FOREIGN KEY (category_id)      REFERENCES categories (id),
    CONSTRAINT fk_txn_subcategory
        FOREIGN KEY (subcategory_id)   REFERENCES subcategories (id),
    CONSTRAINT fk_txn_place
        FOREIGN KEY (place_id)         REFERENCES places (id),
    CONSTRAINT fk_txn_income_source
        FOREIGN KEY (income_source_id) REFERENCES income_sources (id),
    CONSTRAINT fk_txn_from_account
        FOREIGN KEY (from_account_id)  REFERENCES accounts (id),
    CONSTRAINT fk_txn_to_account
        FOREIGN KEY (to_account_id)    REFERENCES accounts (id),
    CONSTRAINT fk_txn_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES users (id),
    CONSTRAINT fk_txn_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
