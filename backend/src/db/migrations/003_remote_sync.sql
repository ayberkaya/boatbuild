-- =============================================================================
-- BoatBuild CRM – Remote developer sync (003)
-- =============================================================================
--
-- INSTRUCTIONS FOR REMOTE DEVELOPER
-- ---------------------------------
-- 1. Place this file in: backend/src/db/migrations/
-- 2. From project root: cd backend && npm run migrate
--
-- This script runs after 001 and 002 (alphabetical order). It only adds
-- missing columns/constraints; it does not change or duplicate seed data.
-- Safe to run multiple times (idempotent). Does not conflict with 001 or 002.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) expenses.payment_method (if missing; 001 may already have added it)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE expenses ADD COLUMN payment_method VARCHAR(20);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) UNIQUE on expense_categories.primary_tag (if missing; 001 may already have it)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expense_categories_primary_tag_key'
    ) THEN
        ALTER TABLE expense_categories ADD CONSTRAINT expense_categories_primary_tag_key UNIQUE (primary_tag);
    END IF;
END $$;
