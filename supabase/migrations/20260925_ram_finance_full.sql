-- RAM FINANCE — FULL DATABASE SCHEMA & MIGRATIONS
-- Implements complete SRS requirements for Client/Loan Sequencing, 
-- Products Master, Installment Schedules, Cash Denominations, 
-- Branch Cash Management, and Audit Logs.

-- 1. SEQUENCES FOR CLIENT ID AND LOAN CYCLES
CREATE SEQUENCE IF NOT EXISTS client_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS loan_cycle_a_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS loan_cycle_b_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS loan_cycle_c_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS loan_cycle_d_seq START WITH 1 INCREMENT BY 1;

-- Functions to generate next IDs
CREATE OR REPLACE FUNCTION get_next_client_id()
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
BEGIN
  SELECT nextval('client_id_seq') INTO next_val;
  RETURN 'RF' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_next_loan_id(cycle_prefix TEXT DEFAULT 'PPRA')
RETURNS TEXT AS $$
DECLARE
  seq_name TEXT;
  next_val BIGINT;
BEGIN
  IF cycle_prefix = 'PPRA' THEN
    SELECT nextval('loan_cycle_a_seq') INTO next_val;
  ELSIF cycle_prefix = 'PPRB' THEN
    SELECT nextval('loan_cycle_b_seq') INTO next_val;
  ELSIF cycle_prefix = 'PPRC' THEN
    SELECT nextval('loan_cycle_c_seq') INTO next_val;
  ELSE
    SELECT nextval('loan_cycle_d_seq') INTO next_val;
  END IF;
  RETURN cycle_prefix || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. ENHANCE CUSTOMERS TABLE
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS nominee_dob DATE,
ADD COLUMN IF NOT EXISTS nominee_address TEXT,
ADD COLUMN IF NOT EXISTS kyc_doc_type TEXT,
ADD COLUMN IF NOT EXISTS kyc_doc_number TEXT,
ADD COLUMN IF NOT EXISTS alternate_mobile TEXT;

-- 3. ENHANCE LOAN PRODUCTS MASTER TABLE
ALTER TABLE loan_products
ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS tenure_weeks INT,
ADD COLUMN IF NOT EXISTS ewi_amount NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS processing_fee_percent NUMERIC(5,2) DEFAULT 3.0,
ADD COLUMN IF NOT EXISTS late_penalty_percent NUMERIC(5,2) DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS foreclosure_charge_percent NUMERIC(5,2) DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 4. ENHANCE LOANS TABLE
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS processing_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS collection_day TEXT,
ADD COLUMN IF NOT EXISTS co_applicant_photo_url TEXT,
ADD COLUMN IF NOT EXISTS property_photo_url TEXT,
ADD COLUMN IF NOT EXISTS security_photo_url TEXT,
ADD COLUMN IF NOT EXISTS disbursement_photo_url TEXT,
ADD COLUMN IF NOT EXISTS nominee_confirmation_url TEXT,
ADD COLUMN IF NOT EXISTS gps_location TEXT,
ADD COLUMN IF NOT EXISTS late_penalty_accrued NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS foreclosure_charges NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closure_notes TEXT;

-- 5. ENHANCE COLLECTIONS TABLE
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS voucher_number TEXT,
ADD COLUMN IF NOT EXISTS denominations JSONB, -- { "2000": 0, "500": 2, "200": 1, ... }
ADD COLUMN IF NOT EXISTS principal_component NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS interest_component NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS penalty_component NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS advance_component NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reversal_reason TEXT,
ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

-- 6. LOAN INSTALLMENT SCHEDULE TABLE
CREATE TABLE IF NOT EXISTS loan_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  due_date DATE NOT NULL,
  principal_due NUMERIC(10,2) NOT NULL,
  interest_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_due NUMERIC(10,2) NOT NULL,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  paid_date DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partially Paid', 'Paid', 'Overdue')),
  delay_days INT DEFAULT 0,
  penalty_amount NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. DAILY BRANCH CASH MANAGEMENT
CREATE TABLE IF NOT EXISTS branch_cash_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_collections NUMERIC(12,2) NOT NULL DEFAULT 0,
  digital_collections NUMERIC(12,2) NOT NULL DEFAULT 0,
  disbursements_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  branch_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_receipts NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_payments NUMERIC(12,2) NOT NULL DEFAULT 0,
  staff_handover NUMERIC(12,2) NOT NULL DEFAULT 0,
  ho_handover NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_cash_system NUMERIC(12,2) NOT NULL DEFAULT 0,
  physical_cash_counted NUMERIC(12,2) NOT NULL DEFAULT 0,
  difference_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Reconciled', 'Discrepancy')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  reconciled_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, record_date)
);

-- 8. WHATSAPP TEMPLATES & NOTIFICATION LOGS
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key TEXT UNIQUE NOT NULL, -- e.g. 'PRE_DEMAND_REMINDER', 'COLLECTION_RECEIPT'
  name TEXT NOT NULL,
  body_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  loan_id UUID REFERENCES loans(id),
  collection_id UUID REFERENCES collections(id),
  channel TEXT DEFAULT 'WhatsApp',
  recipient_mobile TEXT NOT NULL,
  message_content TEXT NOT NULL,
  status TEXT DEFAULT 'Sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. AUDIT LOGS FOR MAKER-CHECKER & SENSITIVE ACTIONS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL, -- e.g. 'APPROVE_DISBURSEMENT', 'REJECT_COLLECTION', 'REVERSE_VOUCHER'
  target_table TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
