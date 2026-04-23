-- =============================================================================
-- Budgeting App — Phase 2 Migration
--
-- Adds the auth_tokens table to an existing Phase 1 database.
-- Safe to run on a fresh database that was created from schema.sql
-- (schema.sql already includes this table via CREATE TABLE IF NOT EXISTS).
--
-- Apply:
--   mysql -u <user> -p <dbname> < apps/api/db/migrate_phase2.sql
-- =============================================================================

SET NAMES utf8mb4;

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
