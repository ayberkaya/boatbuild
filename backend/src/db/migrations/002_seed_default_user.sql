-- Migration: Seed default user when no users exist
-- Idempotent: only inserts if users table is empty (e.g. fresh deploy, or DB had schema but no seed).
-- Default credentials: owner@boatbuild.com / owner123 (change after first login in production).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Seed Owner (idempotent: only when no users exist)
INSERT INTO users (email, password_hash, full_name, role)
SELECT
    'owner@boatbuild.com',
    crypt('owner123', gen_salt('bf', 12)),
    'Owner',
    'OWNER'::user_role
WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);

-- Seed Operation user (idempotent: only when kaan does not exist)
INSERT INTO users (email, password_hash, full_name, role)
SELECT
    'kaan@boatbuild.com',
    crypt('operation123', gen_salt('bf', 12)),
    'Kaan (Operation)',
    'OPERATION'::user_role
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'kaan@boatbuild.com');
