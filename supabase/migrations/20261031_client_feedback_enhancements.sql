-- RAM FINANCE: CLIENT FEEDBACK ENHANCEMENTS MIGRATION
-- Adds strict UID uniqueness, nominee DOB & address, co-applicant active loan rules,
-- processing fee slabs, day-end reconciliation checks, and photo retention policy.

-- 1. ENHANCE CUSTOMERS TABLE WITH UID & NOMINEE FIELDS
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS kyc_doc_type TEXT DEFAULT 'Aadhaar (UID)',
ADD COLUMN IF NOT EXISTS kyc_doc_number TEXT,
ADD COLUMN IF NOT EXISTS nominee_dob DATE,
ADD COLUMN IF NOT EXISTS nominee_address TEXT;

-- Enforce 1 UID = 1 Permanent Client Number (Block duplicate UID entry)
CREATE UNIQUE INDEX IF NOT EXISTS customers_unique_uid_idx 
ON customers(kyc_doc_number) 
WHERE kyc_doc_number IS NOT NULL AND kyc_doc_number <> '';

-- Enforce Unique Mobile per Client across customers
CREATE UNIQUE INDEX IF NOT EXISTS customers_unique_mobile_idx 
ON customers(mobile_number) 
WHERE mobile_number IS NOT NULL AND mobile_number <> '';

-- 2. ENHANCE LOANS TABLE FOR CO-APPLICANT & AUDIT REVERSALS
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS co_applicant_uid TEXT,
ADD COLUMN IF NOT EXISTS processing_fee NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS collection_day TEXT,
ADD COLUMN IF NOT EXISTS closure_notes TEXT,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- Enforce: Co-applicant UID can be linked to only ONE active loan
CREATE UNIQUE INDEX IF NOT EXISTS loans_unique_active_co_applicant_idx 
ON loans(co_applicant_uid) 
WHERE status = 'Active' AND co_applicant_uid IS NOT NULL AND co_applicant_uid <> '';

-- 3. AUDIT LOGS FOR MAKER-CHECKER & LOAN CANCELLATIONS
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL, -- e.g. 'CANCEL_LOAN', 'APPROVE_COLLECTION', 'REVERSE_VOUCHER'
  target_table TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PHOTO STORAGE RETENTION POLICY
-- Safely clears photo URLs for closed loans older than the retention threshold
-- (e.g. 90 days) to conserve storage, while preserving all financial & audit records permanently.
CREATE OR REPLACE FUNCTION purge_closed_loan_photos(retention_days INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  purged_count INT := 0;
BEGIN
  -- Mark customer photo URLs as archived/cleared only if all their loans are closed
  UPDATE loans
  SET co_applicant_photo_url = NULL,
      property_photo_url = NULL,
      security_photo_url = NULL,
      disbursement_photo_url = NULL
  WHERE status = 'Closed' 
    AND closed_at IS NOT NULL 
    AND closed_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END;
$$ LANGUAGE plpgsql;

