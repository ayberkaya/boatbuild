-- =============================================================================
-- BoatBuild CRM – Single idempotent migration
-- =============================================================================
-- Run once per environment. Safe to run multiple times (no duplicate data, no errors).
-- Combines: Trideck categories + payment_method column, seed users, 6 vendors.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Deduplicate expense_categories by primary_tag (so UNIQUE can be added)
--    Keep one row per primary_tag (smallest category_id); point expenses to it; delete rest.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT d.primary_tag, d.keep_id
    FROM (
      SELECT DISTINCT ON (primary_tag) primary_tag, category_id AS keep_id
      FROM expense_categories
      ORDER BY primary_tag, ctid
    ) d
    WHERE (SELECT COUNT(*) FROM expense_categories e WHERE e.primary_tag = d.primary_tag) > 1
  ) LOOP
    UPDATE expenses SET category_id = r.keep_id
    WHERE category_id IN (
      SELECT category_id FROM expense_categories
      WHERE primary_tag = r.primary_tag AND category_id != r.keep_id
    );
    DELETE FROM expense_categories
    WHERE primary_tag = r.primary_tag AND category_id != r.keep_id;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 1) UNIQUE on expense_categories.primary_tag (required for ON CONFLICT below)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expense_categories_primary_tag_key'
    ) THEN
        ALTER TABLE expense_categories ADD CONSTRAINT expense_categories_primary_tag_key UNIQUE (primary_tag);
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Trideck expense categories (INSERT or UPDATE by primary_tag)
-- -----------------------------------------------------------------------------
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

INSERT INTO expense_categories (name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description)
VALUES
    ('Kaan Ödemeler', 'KAAN_ODEME', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Kaan''a yapılan hakediş ödemeleri')
ON CONFLICT (primary_tag) DO UPDATE SET
    name = EXCLUDED.name,
    default_work_scope = EXCLUDED.default_work_scope,
    default_hak_edis_policy = EXCLUDED.default_hak_edis_policy,
    description = EXCLUDED.description;

INSERT INTO expense_categories (name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description)
VALUES
    ('Etkin Gürel', 'ETKIN', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Etkin Gürel ödemeleri')
ON CONFLICT (primary_tag) DO UPDATE SET
    name = EXCLUDED.name,
    default_work_scope = EXCLUDED.default_work_scope,
    default_hak_edis_policy = EXCLUDED.default_hak_edis_policy,
    description = EXCLUDED.description;

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

-- -----------------------------------------------------------------------------
-- 3) expenses.payment_method column (if not exists)
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
-- 4) Seed users (idempotent: ON CONFLICT email DO NOTHING)
-- -----------------------------------------------------------------------------
INSERT INTO users (email, password_hash, full_name, role)
VALUES
    ('owner@boatbuild.com', '$2a$12$7z75BaOIT8H5TOmHgD2kFu7u9xFswC2WY5F4/dJUwE2fGkgkk5Lh.', 'Owner', 'OWNER'),
    ('kaan@boatbuild.com', '$2a$12$y33R1s/pTJo8wp.gB8oKzOixXfK7EE4.0RbdaT78YmNHlIWVCct6.', 'Kaan (Operation)', 'OPERATION')
ON CONFLICT (email) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5) Vendors used by expenses but not yet in vendors table (idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO vendors (name, requires_documentation, notes)
SELECT 'Tedarikçi', false, 'Genel tedarikçi – giderlerde tedarikçi adı belirtilmemiş veya genel kullanılan kayıt'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE LOWER(TRIM(name)) = 'tedarikçi');

INSERT INTO vendors (name, requires_documentation, notes)
SELECT 'Kaan', true, 'Kaan ödemeleri – hakediş'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE LOWER(TRIM(name)) = 'kaan');

INSERT INTO vendors (name, requires_documentation, notes)
SELECT 'Hangar', false, 'Hangar / tersane ile ilgili giderler'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE LOWER(TRIM(name)) = 'hangar');

INSERT INTO vendors (name, requires_documentation, notes)
SELECT 'Kara Parkı', false, 'Kara parkı / tersane kiralama'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE LOWER(TRIM(name)) = 'kara parkı');

INSERT INTO vendors (name, requires_documentation, notes)
SELECT 'Tenteci', false, 'Tente işleri tedarikçisi'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE LOWER(TRIM(name)) = 'tenteci');

INSERT INTO vendors (name, requires_documentation, notes)
SELECT 'Tolga Akdağ', false, 'Tersane tente – Tolga Akdağ'
WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE LOWER(TRIM(name)) = 'tolga akdağ');
