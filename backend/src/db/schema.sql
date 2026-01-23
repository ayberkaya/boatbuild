-- BoatBuild CRM Database Schema
-- Production-grade CRM-first financial system for boat manufacturing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- ENUMS
-- ===========================================

CREATE TYPE user_role AS ENUM ('OWNER', 'OPERATION');
CREATE TYPE work_scope_level AS ENUM ('PURE_IMALAT', 'MALZEME_PLUS_IMALAT', 'PURE_MALZEME', 'NON_IMALAT');
CREATE TYPE hak_edis_policy AS ENUM ('ALWAYS_INCLUDED', 'ALWAYS_EXCLUDED', 'CONDITIONAL');
CREATE TYPE transfer_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE override_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE document_type AS ENUM ('INVOICE', 'CONTRACT', 'RECEIPT', 'WORK_ORDER', 'DELIVERY_NOTE', 'OTHER');

-- ===========================================
-- USERS TABLE
-- ===========================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- VENDORS TABLE
-- ===========================================

CREATE TABLE vendors (
    vendor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    tax_number VARCHAR(50),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    requires_documentation BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- EXPENSE CATEGORIES TABLE
-- ===========================================

CREATE TABLE expense_categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    primary_tag VARCHAR(100) NOT NULL,
    default_work_scope work_scope_level NOT NULL,
    default_hak_edis_policy hak_edis_policy NOT NULL,
    requires_documentation BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- TRANSFERS TABLE
-- ===========================================

CREATE TABLE transfers (
    transfer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'TRY',
    from_account VARCHAR(255),
    to_account VARCHAR(255),
    vendor_id UUID REFERENCES vendors(vendor_id),
    description TEXT,
    status transfer_status DEFAULT 'PENDING',
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(user_id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- EXPENSES TABLE (CORE)
-- ===========================================

CREATE TABLE expenses (
    expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    vendor_id UUID REFERENCES vendors(vendor_id),
    vendor_name VARCHAR(255) NOT NULL, -- Denormalized for quick reference
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'TRY',
    description TEXT,
    
    -- MANDATORY FIELDS (CANNOT BE NULL)
    primary_tag VARCHAR(100) NOT NULL,
    work_scope_level work_scope_level NOT NULL,
    hak_edis_policy hak_edis_policy NOT NULL,
    
    -- CALCULATED FIELDS (Rule Engine Output)
    is_hak_edis_eligible BOOLEAN NOT NULL DEFAULT false,
    hak_edis_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    hak_edis_rate NUMERIC(5, 4) DEFAULT 0.07,
    
    -- TRACKING
    linked_transfer_id UUID REFERENCES transfers(transfer_id),
    category_id UUID REFERENCES expense_categories(category_id),
    
    -- OVERRIDE TRACKING
    has_owner_override BOOLEAN DEFAULT false,
    override_id UUID,
    
    -- AUDIT
    created_by UUID REFERENCES users(user_id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- CONSTRAINTS
    CONSTRAINT chk_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_hak_edis_non_negative CHECK (hak_edis_amount >= 0)
);

-- ===========================================
-- HAK EDİŞ OVERRIDES TABLE
-- ===========================================

CREATE TABLE hak_edis_overrides (
    override_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID REFERENCES expenses(expense_id) NOT NULL,
    
    -- Original values (before override)
    original_is_eligible BOOLEAN NOT NULL,
    original_hak_edis_amount NUMERIC(15, 2) NOT NULL,
    
    -- Requested override
    requested_is_eligible BOOLEAN NOT NULL,
    requested_hak_edis_amount NUMERIC(15, 2) NOT NULL,
    
    -- Override reason (mandatory for CONDITIONAL items)
    reason TEXT NOT NULL,
    
    -- Approval workflow
    status override_status DEFAULT 'PENDING',
    requested_by UUID REFERENCES users(user_id) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Only Owner can approve
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- DOCUMENTS TABLE
-- ===========================================

CREATE TABLE documents (
    document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID REFERENCES expenses(expense_id),
    transfer_id UUID REFERENCES transfers(transfer_id),
    vendor_id UUID REFERENCES vendors(vendor_id),
    
    document_type document_type NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    
    description TEXT,
    
    uploaded_by UUID REFERENCES users(user_id) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_has_reference CHECK (
        expense_id IS NOT NULL OR transfer_id IS NOT NULL OR vendor_id IS NOT NULL
    )
);

-- ===========================================
-- CONTRACTS TABLE
-- ===========================================

CREATE TABLE contracts (
    contract_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(vendor_id) NOT NULL,
    contract_number VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    
    start_date DATE,
    end_date DATE,
    total_amount NUMERIC(15, 2),
    currency VARCHAR(10) DEFAULT 'TRY',
    
    terms TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE',
    
    created_by UUID REFERENCES users(user_id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- ALERTS TABLE (System-generated warnings)
-- ===========================================

CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Related entities
    expense_id UUID REFERENCES expenses(expense_id),
    transfer_id UUID REFERENCES transfers(transfer_id),
    vendor_id UUID REFERENCES vendors(vendor_id),
    
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(user_id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- AUDIT LOG TABLE
-- ===========================================

CREATE TABLE audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_vendor ON expenses(vendor_id);
CREATE INDEX idx_expenses_primary_tag ON expenses(primary_tag);
CREATE INDEX idx_expenses_work_scope ON expenses(work_scope_level);
CREATE INDEX idx_expenses_hak_edis_eligible ON expenses(is_hak_edis_eligible);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);

CREATE INDEX idx_transfers_date ON transfers(date);
CREATE INDEX idx_transfers_status ON transfers(status);
CREATE INDEX idx_transfers_vendor ON transfers(vendor_id);

CREATE INDEX idx_overrides_expense ON hak_edis_overrides(expense_id);
CREATE INDEX idx_overrides_status ON hak_edis_overrides(status);

CREATE INDEX idx_documents_expense ON documents(expense_id);
CREATE INDEX idx_documents_transfer ON documents(transfer_id);

CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_resolved ON alerts(is_resolved);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- ===========================================
-- SEED DATA: Default Expense Categories
-- ===========================================

INSERT INTO expense_categories (name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description) VALUES
-- PURE_IMALAT Categories (Always 7%)
('Kaynak İşçiliği', 'KAYNAK', 'PURE_IMALAT', 'ALWAYS_INCLUDED', false, 'Pure welding labor - always eligible'),
('Montaj İşçiliği', 'MONTAJ', 'PURE_IMALAT', 'ALWAYS_INCLUDED', false, 'Assembly labor - always eligible'),
('Tesisat İşçiliği', 'TESISAT', 'PURE_IMALAT', 'ALWAYS_INCLUDED', false, 'Installation labor - always eligible'),
('Elektrik İşçiliği', 'ELEKTRIK', 'PURE_IMALAT', 'ALWAYS_INCLUDED', false, 'Electrical work labor - always eligible'),

-- MALZEME_PLUS_IMALAT Categories
('Cam + Montaj', 'CAM', 'MALZEME_PLUS_IMALAT', 'CONDITIONAL', true, 'Glass with installation - conditional'),
('Parke + Döşeme', 'PARKE', 'MALZEME_PLUS_IMALAT', 'CONDITIONAL', true, 'Flooring with installation - conditional'),
('Boya + Uygulama', 'BOYA', 'MALZEME_PLUS_IMALAT', 'CONDITIONAL', true, 'Paint with application - conditional'),
('Mobilya + Montaj', 'MOBILYA', 'MALZEME_PLUS_IMALAT', 'CONDITIONAL', true, 'Furniture with installation - conditional'),

-- PURE_MALZEME Categories (Never eligible)
('Ham Malzeme', 'MALZEME', 'PURE_MALZEME', 'ALWAYS_EXCLUDED', false, 'Raw materials only - never eligible'),
('Motor', 'MOTOR', 'PURE_MALZEME', 'ALWAYS_EXCLUDED', true, 'Engine/motor purchase - never eligible, requires docs'),
('Elektronik Ekipman', 'ELEKTRONIK', 'PURE_MALZEME', 'ALWAYS_EXCLUDED', true, 'Electronic equipment - never eligible'),

-- NON_IMALAT Categories (Never eligible)
('Reklam Gideri', 'REKLAM', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Advertising expense - never eligible, requires docs'),
('İdari Gider', 'IDARI', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Administrative expense - never eligible'),
('Nakliye', 'NAKLIYE', 'NON_IMALAT', 'ALWAYS_EXCLUDED', false, 'Transportation - never eligible'),
('Sigorta', 'SIGORTA', 'NON_IMALAT', 'ALWAYS_EXCLUDED', true, 'Insurance - never eligible');

-- ===========================================
-- SEED DATA: Special Vendors requiring documentation
-- ===========================================

INSERT INTO vendors (name, requires_documentation, notes) VALUES
('BARAN', true, 'Special vendor - requires mandatory documentation'),
('MOTOR', true, 'Motor supplier - requires mandatory documentation'),
('ETKIN', true, 'Special vendor - requires mandatory documentation');

-- ===========================================
-- VIEWS
-- ===========================================

-- View: Expense Summary with Hak Ediş
CREATE VIEW v_expense_summary AS
SELECT 
    e.expense_id,
    e.date,
    e.vendor_name,
    e.amount,
    e.currency,
    e.primary_tag,
    e.work_scope_level,
    e.hak_edis_policy,
    e.is_hak_edis_eligible,
    e.hak_edis_amount,
    e.has_owner_override,
    t.status as transfer_status,
    CASE 
        WHEN e.linked_transfer_id IS NULL THEN true 
        ELSE false 
    END as missing_transfer,
    e.created_at
FROM expenses e
LEFT JOIN transfers t ON e.linked_transfer_id = t.transfer_id;

-- View: Hak Ediş Totals
CREATE VIEW v_hak_edis_totals AS
SELECT 
    work_scope_level,
    hak_edis_policy,
    COUNT(*) as expense_count,
    SUM(amount) as total_amount,
    SUM(hak_edis_amount) as total_hak_edis,
    SUM(CASE WHEN is_hak_edis_eligible THEN amount ELSE 0 END) as eligible_amount
FROM expenses
GROUP BY work_scope_level, hak_edis_policy;

-- View: Pending Overrides
CREATE VIEW v_pending_overrides AS
SELECT 
    o.*,
    e.date as expense_date,
    e.vendor_name,
    e.amount as expense_amount,
    e.primary_tag,
    e.work_scope_level,
    u.full_name as requested_by_name
FROM hak_edis_overrides o
JOIN expenses e ON o.expense_id = e.expense_id
JOIN users u ON o.requested_by = u.user_id
WHERE o.status = 'PENDING';

-- View: Active Alerts
CREATE VIEW v_active_alerts AS
SELECT * FROM alerts WHERE is_resolved = false ORDER BY 
    CASE severity 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
    END,
    created_at DESC;
