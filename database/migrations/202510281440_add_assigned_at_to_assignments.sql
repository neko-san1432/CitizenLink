ALTER TABLE complaint_assignments
ADD COLUMN assigned_at TIMESTAMPTZ DEFAULT NOW();
