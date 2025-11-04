-- Manual SQL script to drop redundant fields from complaints table
-- Run this in Supabase SQL Editor

-- Step 1: Drop RLS policies that might reference the fields we're removing
DROP POLICY IF EXISTS "Citizens can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Citizens can update own pending complaints" ON public.complaints;
DROP POLICY IF EXISTS "Coordinators can view assigned complaints" ON public.complaints;
DROP POLICY IF EXISTS "Coordinators can update assigned complaints" ON public.complaints;
DROP POLICY IF EXISTS "LGU admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "LGU admins can update all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Super admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Super admins can update all complaints" ON public.complaints;

-- Step 2: Drop the redundant columns
ALTER TABLE public.complaints DROP COLUMN IF EXISTS type;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS status;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS primary_department;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS secondary_departments;
ALTER TABLE public.complaints DROP COLUMN IF EXISTS evidence;

-- Step 3: Recreate essential RLS policies
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Citizens can view their own complaints
CREATE POLICY "Citizens can view own complaints" ON public.complaints
  FOR SELECT USING (submitted_by = auth.uid());

-- Citizens can update their own pending complaints
CREATE POLICY "Citizens can update own pending complaints" ON public.complaints
  FOR UPDATE USING (
    submitted_by = auth.uid() 
    AND workflow_status IN ('new', 'assigned')
  );

-- Coordinators can view complaints assigned to them
CREATE POLICY "Coordinators can view assigned complaints" ON public.complaints
  FOR SELECT USING (
    assigned_coordinator_id = auth.uid()
    OR workflow_status IN ('new', 'assigned')
  );

-- Coordinators can update complaints assigned to them
CREATE POLICY "Coordinators can update assigned complaints" ON public.complaints
  FOR UPDATE USING (
    assigned_coordinator_id = auth.uid()
    AND workflow_status IN ('assigned', 'in_progress', 'pending_approval')
  );

-- LGU admins can view all complaints
CREATE POLICY "LGU admins can view all complaints" ON public.complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' IN ('lgu_admin', 'lgu_officer')
    )
  );

-- LGU admins can update all complaints
CREATE POLICY "LGU admins can update all complaints" ON public.complaints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' IN ('lgu_admin', 'lgu_officer')
    )
  );

-- Super admins can view all complaints
CREATE POLICY "Super admins can view all complaints" ON public.complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- Super admins can update all complaints
CREATE POLICY "Super admins can update all complaints" ON public.complaints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- Step 4: Create helper functions for derived fields
CREATE OR REPLACE FUNCTION get_complaint_status(workflow_status text)
RETURNS text AS $$
BEGIN
  RETURN CASE 
    WHEN workflow_status = 'new' THEN 'pending review'
    WHEN workflow_status = 'assigned' THEN 'in progress'
    WHEN workflow_status = 'in_progress' THEN 'in progress'
    WHEN workflow_status = 'pending_approval' THEN 'in progress'
    WHEN workflow_status = 'completed' THEN 'resolved'
    WHEN workflow_status = 'cancelled' THEN 'rejected'
    ELSE 'pending review'
  END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_primary_department(department_r text[])
RETURNS text AS $$
BEGIN
  IF array_length(department_r, 1) > 0 THEN
    RETURN department_r[1];
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_secondary_departments(department_r text[])
RETURNS text[] AS $$
BEGIN
  IF array_length(department_r, 1) > 1 THEN
    RETURN department_r[2:];
  ELSE
    RETURN ARRAY[]::text[];
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_complaints_workflow_status ON public.complaints(workflow_status);
CREATE INDEX IF NOT EXISTS idx_complaints_department_r ON public.complaints USING GIN(department_r);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_by_workflow ON public.complaints(submitted_by, workflow_status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_coordinator ON public.complaints(assigned_coordinator_id) WHERE assigned_coordinator_id IS NOT NULL;

-- Step 6: Create a view for backward compatibility
CREATE OR REPLACE VIEW complaints_legacy AS
SELECT 
  id,
  submitted_by,
  title,
  'complaint' as type, -- Always 'complaint'
  subtype,
  descriptive_su,
  location_text,
  latitude,
  longitude,
  department_r,
  get_complaint_status(workflow_status) as status, -- Derived from workflow_status
  workflow_status,
  priority,
  get_primary_department(department_r) as primary_department, -- Derived from department_r[0]
  get_secondary_departments(department_r) as secondary_departments, -- Derived from department_r[1:]
  assigned_coordinator_id,
  response_deadline,
  citizen_satisfaction_rating,
  is_duplicate,
  master_complaint_id,
  task_force_id,
  coordinator_notes,
  estimated_resolution_date,
  submitted_at,
  updated_at,
  cancelled_at,
  cancellation_reason,
  cancelled_by,
  last_activity_at,
  preferred_departments,
  resolution_notes,
  resolved_by,
  resolved_at,
  confirmed_by_citizen,
  citizen_confirmation_date
FROM public.complaints;

-- Step 7: Add comments for documentation
COMMENT ON TABLE public.complaints IS 'Complaints table with redundant fields removed. Use helper functions for derived fields.';
COMMENT ON COLUMN public.complaints.workflow_status IS 'Primary status field. Use get_complaint_status() to get legacy status.';
COMMENT ON COLUMN public.complaints.department_r IS 'Array of department codes. Use get_primary_department() and get_secondary_departments() for individual fields.';
COMMENT ON VIEW public.complaints_legacy IS 'Legacy view for backward compatibility. Use this if you need the old field names.';

-- Migration completed successfully!
-- The following fields have been removed:
-- - type (always 'complaint')
-- - status (derived from workflow_status)
-- - primary_department (derived from department_r[0])
-- - secondary_departments (derived from department_r[1:])
-- - evidence (use complaint_evidence table instead)























