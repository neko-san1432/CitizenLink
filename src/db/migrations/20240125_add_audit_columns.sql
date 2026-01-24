-- Add audit columns for safe delegation/deletion support
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS submitted_by_snapshot JSONB,
ADD COLUMN IF NOT EXISTS account_preservation_data JSONB,
ADD COLUMN IF NOT EXISTS original_submitter_id UUID;

-- Add description comments
COMMENT ON COLUMN complaints.submitted_by_snapshot IS 'Snapshot of user profile at time of submission (name, email, etc) in case account is deleted';
COMMENT ON COLUMN complaints.account_preservation_data IS 'Additional preservation data for audit';
COMMENT ON COLUMN complaints.original_submitter_id IS 'UUID of the original submitter, preserved even if submitted_by FK is set to NULL';
