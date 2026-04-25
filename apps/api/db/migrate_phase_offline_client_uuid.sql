-- =============================================================================
-- Budgeting App — Offline/PWA prep
-- Add client_uuid to transactions for idempotent offline sync.
--
-- Safe migration notes:
-- - Adds a nullable column only
-- - Existing rows remain untouched
-- - Existing application behavior should remain unchanged until code starts using it
-- - Uniqueness is scoped per creator to avoid cross-user collisions
--
-- Apply to an existing database:
--   mysql -u <user> -p <dbname> < apps/api/db/migrate_phase_offline_client_uuid.sql
-- =============================================================================

ALTER TABLE transactions
    ADD COLUMN client_uuid CHAR(36) NULL AFTER id,
    ADD KEY idx_txn_client_uuid (client_uuid),
    ADD UNIQUE KEY uq_txn_created_by_client_uuid (created_by_user_id, client_uuid);
