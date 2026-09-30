-- 1. Update the role constraint in profiles to include future roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN (
  'Staff', 
  'Manager', 
  'Admin', 
  'Branch Manager', 
  'Regional Manager', 
  'Accounts', 
  'HO', 
  'Auditor',
  'Viewer'
));

-- 2. Create User Activity Tracking table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- e.g., 'LOGIN', 'CREATE_CUSTOMER', 'APPROVE_LOAN'
  description TEXT,
  target_type TEXT, -- e.g., 'customers', 'loans'
  target_id UUID,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
