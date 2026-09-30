-- Add center_id to profiles for Staff to Center assignment
ALTER TABLE profiles 
ADD COLUMN center_id UUID REFERENCES centers(id);

-- Add rejection_reason and approved_at to loans for the Maker-Checker workflow
ALTER TABLE loans
ADD COLUMN rejection_reason TEXT,
ADD COLUMN approved_at TIMESTAMPTZ;

-- Add rejection_reason and approved_at to collections for the Maker-Checker workflow
ALTER TABLE collections
ADD COLUMN rejection_reason TEXT,
ADD COLUMN approved_at TIMESTAMPTZ;
