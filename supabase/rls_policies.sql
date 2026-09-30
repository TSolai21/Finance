-- RAM Finance - Enable Access Policies
-- Run this in your Supabase SQL Editor to allow the web app to read and write data.

-- Ensure RLS is enabled for all tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for the 'anon' role so the UI can function without login (MVP phase)

-- Branches
DROP POLICY IF EXISTS "Allow public access" ON branches;
CREATE POLICY "Allow public access" ON branches FOR ALL USING (true) WITH CHECK (true);

-- Centers
DROP POLICY IF EXISTS "Allow public access" ON centers;
CREATE POLICY "Allow public access" ON centers FOR ALL USING (true) WITH CHECK (true);

-- Profiles
DROP POLICY IF EXISTS "Allow public access" ON profiles;
CREATE POLICY "Allow public access" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- Customers
DROP POLICY IF EXISTS "Allow public access" ON customers;
CREATE POLICY "Allow public access" ON customers FOR ALL USING (true) WITH CHECK (true);

-- Loan Products
DROP POLICY IF EXISTS "Allow public access" ON loan_products;
CREATE POLICY "Allow public access" ON loan_products FOR ALL USING (true) WITH CHECK (true);

-- Loans
DROP POLICY IF EXISTS "Allow public access" ON loans;
CREATE POLICY "Allow public access" ON loans FOR ALL USING (true) WITH CHECK (true);

-- Collections
DROP POLICY IF EXISTS "Allow public access" ON collections;
CREATE POLICY "Allow public access" ON collections FOR ALL USING (true) WITH CHECK (true);
