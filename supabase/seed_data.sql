-- RAM Finance - Seed Data
-- Paste this into your Supabase SQL Editor to populate sample data

-- 1. Insert Branch
INSERT INTO branches (id, name, code) 
VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'North District', 'BR01')
ON CONFLICT (code) DO NOTHING;

-- 2. Insert Center
INSERT INTO centers (id, branch_id, name, meeting_day) 
VALUES ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Market Center', 'Monday')
ON CONFLICT DO NOTHING;

-- 3. Insert Customers
INSERT INTO customers (id, client_id, full_name, mobile_number, gender, address, center_id) 
VALUES 
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'RF0001', 'Anita Sharma', '+919876543210', 'Female', '123 Market Rd', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'RF0002', 'Vikram Singh', '+919876543211', 'Male', '456 Hill St', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22')
ON CONFLICT (client_id) DO NOTHING;

-- 4. Insert Loan Products
INSERT INTO loan_products (id, name, type, interest_rate) 
VALUES ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'Standard Micro', 'Micro Finance', 12.0)
ON CONFLICT DO NOTHING;

-- 5. Insert Loans
INSERT INTO loans (id, customer_id, product_id, loan_id, principal_amount, tenure_weeks, status) 
VALUES 
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'PPRA0001', 15000, 25, 'Active'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'PPRA0002', 25000, 30, 'Pending Approval')
ON CONFLICT (loan_id) DO NOTHING;

-- 6. Insert Collections
INSERT INTO collections (id, loan_id, customer_id, amount, payment_mode, status) 
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a88', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 750, 'Cash', 'Pending Approval')
ON CONFLICT DO NOTHING;
