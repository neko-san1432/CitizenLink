-- Migration: Fix complaint_assignments.department_id type mismatch
-- Change department_id from uuid to bigint to match departments.id

-- Step 1: Drop any existing foreign key constraints on department_id (if any)
DO $$
BEGIN
  -- Drop foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%department_id%'   