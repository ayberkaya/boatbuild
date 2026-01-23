
-- Expenses Table
CREATE TABLE expenses (
  expense_id UUID PRIMARY KEY,
  date DATE,
  vendor_name TEXT,
  amount NUMERIC,
  currency TEXT,
  primary_tag TEXT,
  work_scope_level TEXT,
  hak_edis_policy TEXT,
  is_hak_edis_eligible BOOLEAN,
  hak_edis_amount NUMERIC,
  linked_transfer_id UUID,
  created_at TIMESTAMP
);
