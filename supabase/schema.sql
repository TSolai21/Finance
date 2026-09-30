-- RAM Finance - Database Schema

-- 1. Branches & Centers
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE centers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meeting_day TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Staff & Users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Staff', 'Manager', 'Admin')),
  full_name TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers (KYC)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT UNIQUE NOT NULL, -- e.g., RF0001
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  dob DATE,
  gender TEXT,
  address TEXT,
  center_id UUID REFERENCES centers(id),
  
  -- Nominee
  nominee_name TEXT,
  nominee_relationship TEXT,
  nominee_mobile TEXT,
  
  -- Media/Docs (stored as URLs/paths in storage)
  photo_url TEXT,
  kyc_doc_url TEXT,
  gps_location TEXT, -- lat,lng
  
  status TEXT DEFAULT 'Active',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Loan Products
CREATE TABLE loan_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Micro Finance', 'LAP', 'Monthly Interest')),
  interest_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Loans
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES loan_products(id),
  loan_id TEXT UNIQUE NOT NULL, -- Cycle based: PPRA0001
  cycle_number INTEGER DEFAULT 1,
  
  principal_amount DECIMAL(12,2) NOT NULL,
  tenure_weeks INTEGER,
  emi_amount DECIMAL(10,2),
  
  status TEXT DEFAULT 'Draft', -- Draft, Pending Approval, Disbursed, Active, Closed
  disbursement_date DATE,
  first_emi_date DATE,
  
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Collections
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  
  amount DECIMAL(10,2) NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Bank Transfer')),
  utr_number TEXT,
  proof_url TEXT,
  
  status TEXT DEFAULT 'Pending Approval', -- Pending Approval, Approved, Rejected
  collected_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
