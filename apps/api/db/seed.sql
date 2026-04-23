-- =============================================================================
-- Budgeting App — Seed Data
-- Phase 1
--
-- Apply after schema:
--   mysql -u <user> -p <dbname> < apps/api/db/seed.sql
--
-- Seed passwords are bcrypt hashes of "password" (cost 10).
-- CHANGE PASSWORDS BEFORE USING IN ANY REAL ENVIRONMENT.
-- =============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- users
-- Default password for both accounts: "password"
-- ---------------------------------------------------------------------------
INSERT INTO users (id, name, username, password_hash, is_active) VALUES
(1, 'Sanz',  'sanz', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1),
(2, 'Kaye',  'kaye', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
INSERT INTO accounts (id, name, type, opening_balance, currency, is_active, sort_order) VALUES
(1, 'BPI Buffer 6888',  'checking', 0.00,  'PHP', 1, 1),
(2, 'BPI Travel 3224',  'savings',  0.00,  'PHP', 1, 2),
(3, 'BDO Savings',      'savings',  0.00,  'PHP', 1, 3),
(4, 'Cash',             'cash',     0.00,  'PHP', 1, 4);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, is_active, sort_order) VALUES
(1, 'Bills',      1, 1),
(2, 'Allowance',  1, 2),
(3, 'Ministry',   1, 3),
(4, 'Food',       1, 4);

-- ---------------------------------------------------------------------------
-- subcategories
-- ---------------------------------------------------------------------------
INSERT INTO subcategories (id, category_id, name, is_active, sort_order) VALUES
-- Bills
( 1, 1, 'Electricity', 1, 1),
( 2, 1, 'Water',       1, 2),
( 3, 1, 'Insurance',   1, 3),
( 4, 1, 'House',       1, 4),
( 5, 1, 'Internet',    1, 5),
-- Allowance
( 6, 2, 'School',      1, 1),
( 7, 2, 'Personal',    1, 2),
( 8, 2, 'Family',      1, 3),
( 9, 2, 'Maintenance', 1, 4),
(10, 2, 'Health',      1, 5),
-- Ministry
(11, 3, 'Tithes',      1, 1),
(12, 3, 'Offering',    1, 2),
-- Food
(13, 4, 'Grocery',     1, 1),
(14, 4, 'Eat-out',     1, 2);

-- ---------------------------------------------------------------------------
-- places
-- ---------------------------------------------------------------------------
INSERT INTO places (id, name, is_active, sort_order) VALUES
(1, 'Ulas',   1, 1),
(2, 'Arakan', 1, 2),
(3, 'Deca',   1, 3);

-- ---------------------------------------------------------------------------
-- income_sources
-- ---------------------------------------------------------------------------
INSERT INTO income_sources (id, name, is_active, sort_order) VALUES
(1, 'Sanz', 1, 1),
(2, 'Kaye', 1, 2);

-- ---------------------------------------------------------------------------
-- monthly_budgets (April 2026 sample)
-- ---------------------------------------------------------------------------
INSERT INTO monthly_budgets (budget_month, category_id, amount, created_by_user_id) VALUES
('2026-04-01', 1, 12000.00, 1),  -- Bills
('2026-04-01', 2,  8000.00, 1),  -- Allowance
('2026-04-01', 3,  3000.00, 1),  -- Ministry
('2026-04-01', 4,  8000.00, 1);  -- Food
