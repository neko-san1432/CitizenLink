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
    AND table_name = 'complaint_assignments'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.complaint_assignments 
    DROP CONSTRAINT IF EXISTS complaint_assignments_department_id_fkey;
  END IF;
END $$;

-- Step 2: Convert department_id from uuid to bigint
-- First, set all existing values to NULL (since we can't convert uuid to bigint)
ALTER TABLE public.complaint_assignments 
  ALTER COLUMN department_id DROP NOT NULL;

UPDATE public.complaint_assignments 
SET department_id = NULL 
WHERE department_id IS NOT NULL;

-- Step 3: Change column type from uuid to bigint
ALTER TABLE public.complaint_assignments 
  ALTER COLUMN department_id TYPE bigint 
  USING NULL;

-- Step 4: Add foreign key constraint to departments table
ALTER TABLE public.complaint_assignments 
  ADD CONSTRAINT complaint_assignments_department_id_fkey 
  FOREIGN KEY (department_id) 
  REFERENCES public.departments(id) 
  ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.complaint_assignments.department_id IS 'Reference to departments table (bigint to match departments.id)';


