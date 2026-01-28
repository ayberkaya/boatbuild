-- Migration: Add Trideck expense categories
-- Date: 2026-01-27
-- Description: Add new expense categories to support Trideck Excel import

-- ===========================================
-- NEW EXPENSE CATEGORIES
-- ===========================================

-- İmalat Categories (PURE_IMALAT - Always 7% hak ediş)
INSERT INTO expense_categories (name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description)
VALUES
    ('İmalat Genel', 'IMALAT_GENEL', 'PURE_IMALAT', 'ALWAYS_INCLUDED', false, 'Genel imalat giderleri - Kaan hakediş dahil'),
    ('İmalat Tesisat', 'IMALAT_TESISAT', 'PURE_IMALAT', 'ALWAYS_INCLUDED', false, 'Tesisat işleri - Kaan hakediş dahil'),
    ('İmalat Elektrik', 'IMALAT_ELEKTRIK', 'PURE_IMALAT', 'ALWAYS_INCLUDED', false, 'Elektrik işleri - Kaan hakediş dahil'),
    ('İmalat Alüminyum', 'IMALAT_ALUMINYUM', 'PURE_IMALAT', 'ALWAYS_INCLUDED', false, 'Alüminyum işleri - Kaan hakediş dahil')
ON CONFLICT (primary_tag) DO UPDATE SET
    name = EXCLUDED.name,
    default_work_scope = EXCLUDED.default_work_scope,
    default_hak_edis_policy = EXCLUDED.default_hak_edis_policy,
    description = EXCLUDED.description;

-- Kaan Payment Category (NON_IMALAT - Never eligible)
INSERT INTO expense_categories (name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description)
VALUES
    ('Kaan Ödemeler', 'KAAN_ODEME', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Kaan''a yapılan hakediş ödemeleri')
ON CONFLICT (primary_tag) DO UPDATE SET
    name = EXCLUDED.name,
    default_work_scope = EXCLUDED.default_work_scope,
    default_hak_edis_policy = EXCLUDED.default_hak_edis_policy,
    description = EXCLUDED.description;

-- Etkin Category (NON_IMALAT - Never eligible)
INSERT INTO expense_categories (name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description)
VALUES
    ('Etkin Gürel', 'ETKIN', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Etkin Gürel ödemeleri')
ON CONFLICT (primary_tag) DO UPDATE SET
    name = EXCLUDED.name,
    default_work_scope = EXCLUDED.default_work_scope,
    default_hak_edis_policy = EXCLUDED.default_hak_edis_policy,
    description = EXCLUDED.description;

-- Yunanistan Kurulum Categories (NON_IMALAT - Never eligible)
INSERT INTO expense_categories (name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description)
VALUES
    ('Yunanistan Avukat', 'YUNANISTAN_AVUKAT', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Yunanistan avukat masrafları'),
    ('Yunanistan Deposit', 'YUNANISTAN_DEPOSIT', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Yunanistan depozito ödemeleri'),
    ('Yunanistan Römork', 'YUNANISTAN_ROMORK', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Yunanistan römork masrafları'),
    ('Yunanistan Sigorta', 'YUNANISTAN_SIGORTA', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Yunanistan sigorta ödemeleri'),
    ('Yunanistan Gümrük', 'YUNANISTAN_GUMRUK', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Yunanistan gümrük masrafları'),
    ('Yunanistan Liman', 'YUNANISTAN_LIMAN', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Yunanistan liman masrafları'),
    ('Yunanistan Kaptan', 'YUNANISTAN_KAPTAN', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Yunanistan kaptan ödemeleri'),
    ('Yunanistan Mazot', 'YUNANISTAN_MAZOT', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Yunanistan mazot/yakıt giderleri'),
    ('Yunanistan Transfer', 'YUNANISTAN_TRANSFER', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Yunanistan transfer masrafları'),
    ('Yunanistan Survey', 'YUNANISTAN_SURVEY', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Yunanistan survey/denetim masrafları')
ON CONFLICT (primary_tag) DO UPDATE SET
    name = EXCLUDED.name,
    default_work_scope = EXCLUDED.default_work_scope,
    default_hak_edis_policy = EXCLUDED.default_hak_edis_policy,
    description = EXCLUDED.description;

-- Tersane Kurulum Categories (NON_IMALAT - Never eligible)
INSERT INTO expense_categories (name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description)
VALUES
    ('Tersane Tente', 'TERSANE_TENTE', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Tente kurulum işleri'),
    ('Tersane Kiralama', 'TERSANE_KIRALAMA', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Tersane/kara parkı kiralama'),
    ('Tersane Genel', 'TERSANE_GENEL', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Genel tersane giderleri')
ON CONFLICT (primary_tag) DO UPDATE SET
    name = EXCLUDED.name,
    default_work_scope = EXCLUDED.default_work_scope,
    default_hak_edis_policy = EXCLUDED.default_hak_edis_policy,
    description = EXCLUDED.description;

-- ===========================================
-- ADD UNIQUE CONSTRAINT IF NOT EXISTS
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expense_categories_primary_tag_key'
    ) THEN
        ALTER TABLE expense_categories ADD CONSTRAINT expense_categories_primary_tag_key UNIQUE (primary_tag);
    END IF;
END $$;

-- ===========================================
-- ADD PAYMENT_METHOD COLUMN IF NOT EXISTS
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE expenses ADD COLUMN payment_method VARCHAR(20);
    END IF;
END $$;

-- ===========================================
-- VERIFY CATEGORIES
-- ===========================================
-- SELECT name, primary_tag, default_work_scope, default_hak_edis_policy FROM expense_categories ORDER BY name;
