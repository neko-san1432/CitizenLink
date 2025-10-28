-- Migration: Remove redundant fields from complaints table
-- This migration removes fields that can be derived from other fields or are no longer needed

-- Step 1: Create a backup view for any existing queries that might reference these fields
CREATE OR REPLACE VIEW complaints_legacy AS
SELECT 
  id,
  submitted_by,
  title,
  'complaint' as type, -- Always 'complaint' - hardcoded
  subtype,
  descriptive_su,
  location_text,
  latitude,
  longitude,
  department_r,
  CASE 
    WHEN workflow_status = 'new' THEN 'pending review'
    WHEN workflow_status = 'assigned' THEN 'in progress'
    WHEN workflow_status = 'in_progress' THEN 'in progress'
    WHEN workflow_status = 'pending_approval' THEN 'in progress'
    WHEN workflow_status = 'completed' THEN 'resolved'
    WHEN workflow_status = 'cancelled' THEN 'rejected'
    ELSE 'pending review'
  END as status, -- Derived from workflow_status
  workflow_status,
  priority,
  CASE 
    WHEN array_length(department_r, 1) > 0 THEN department_r[1]
    ELSE NULL
  END as primary_department, -- Derived from department_r[0]
  CASE 
    WHEN array_length(department_r, 1) > 1 THEN department_r[2:]
    ELSE ARRAY[]::text[]
  END as secondary_departments, -- Derived from department_r[1:]
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

-- Step 2: Drop RLS policies that might reference the fields we're removing
DROP POLICY IF EXISTS "Citizens can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Citizens can update own pending complaints" ON public.complaints;
DROP POLICY IF EXISTS "Coordinators can view assigned complaints" ON public.complaints;
DROP POLICY IF EXISTS "Coordinators can update assigned complaints" ON public.complaints;
DROP POLICY IF EXISTS "LGU admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "LGU admins can update all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Super admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Super admins can update all complaints" ON public.complaints;

-- Step 3: Remove the redundant columns
ALTER TABLE public.complaints 
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS primary_department,
  DROP COLUMN IF EXISTS secondary_departments,
  DROP COLUMN IF EXISTS evidence;

-- Step 4: Recreate RLS policies using only the remaining fields
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Policy: Citizens can view their own complaints
CREATE POLICY "Citizens can view own complaints" ON public.complaints
  FOR SELECT USING (submitted_by = auth.uid());

-- Policy: Citizens can update their own pending complaints (using workflow_status)
CREATE POLICY "Citizens can update own pending complaints" ON public.complaints
  FOR UPDATE USING (
    submitted_by = auth.uid() 
    AND workflow_status IN ('new', 'assigned')
  );

-- Policy: Coordinators can view complaints assigned to them
CREATE POLICY "Coordinators can view assigned complaints" ON public.complaints
  FOR SELECT USING (
    assigned_coordinator_id = auth.uid()
    OR workflow_status IN ('new', 'assigned')
  );

-- Policy: Coordinators can update complaints assigned to them
CREATE POLICY "Coordinators can update assigned complaints" ON public.complaints
  FOR UPDATE USING (
    assigned_coordinator_id = auth.uid()
    AND workflow_status IN ('assigned', 'in_progress', 'pending_approval')
  );

-- Policy: LGU admins can view all complaints
CREATE POLICY "LGU admins can view all complaints" ON public.complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' IN ('lgu_admin', 'lgu_officer')
    )
  );

-- Policy: LGU admins can update all complaints
CREATE POLICY "LGU admins can update all complaints" ON public.complaints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' IN ('lgu_admin', 'lgu_officer')
    )
  );

-- Policy: Super admins can view all complaints
CREATE POLICY "Super admins can view all complaints" ON public.complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- Policy: Super admins can update all complaints
CREATE POLICY "Super admins can update all complaints" ON public.complaints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'super_admin'
    )
  );

-- Step 5: Create helper functions for backward compatibility
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

-- Step 6: Add indexes for better performance on remaining fields
CREATE INDEX IF NOT EXISTS idx_complaints_workflow_status ON public.complaints(workflow_status);
CREATE INDEX IF NOT EXISTS idx_complaints_department_r ON public.complaints USING GIN(department_r);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_by_workflow ON public.complaints(submitted_by, workflow_status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_coordinator ON public.complaints(assigned_coordinator_id) WHERE assigned_coordinator_id IS NOT NULL;

-- Step 7: Add comments for documentation
COMMENT ON TABLE public.complaints IS 'Complaints table with redundant fields removed. Use helper functions for derived fields.';
COMMENT ON COLUMN public.complaints.workflow_status IS 'Primary status field. Use get_complaint_status() to get legacy status.';
COMMENT ON COLUMN public.complaints.department_r IS 'Array of department codes. Use get_primary_department() and get_secondary_departments() for individual fields.';
COMMENT ON VIEW public.complaints_legacy IS 'Legacy view for backward compatibility. Use this if you need the old field names.';

-- Step 8: Update any existing data that might have inconsistencies
-- This ensures all complaints have proper workflow_status
UPDATE public.complaints 
SET workflow_status = 'new' 
WHERE workflow_status IS NULL;

-- Step 9: Add constraints to ensure data integrity
ALTER TABLE public.complaints 
  ALTER COLUMN workflow_status SET NOT NULL,
  ALTER COLUMN workflow_status SET DEFAULT 'new';

-- Step 10: Create a function to get complaint with all derived fields
CREATE OR REPLACE FUNCTION get_complaint_with_derived_fields(complaint_id uuid)
RETURNS TABLE (
  id uuid,
  submitted_by uuid,
  title text,
  type text,
  subtype text,
  descriptive_su text,
  location_text text,
  latitude double precision,
  longitude double precision,
  department_r text[],
  status text,
  workflow_status text,
  priority text,
  primary_department text,
  secondary_departments text[],
  assigned_coordinator_id uuid,
  response_deadline timestamp with time zone,
  citizen_satisfaction_rating integer,
  is_duplicate boolean,
  master_complaint_id uuid,
  task_force_id uuid,
  coordinator_notes text,
  estimated_resolution_date timestamp with time zone,
  submitted_at timestamp with time zone,
  updated_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  cancelled_by uuid,
  last_activity_at timestamp with time zone,
  preferred_departments jsonb,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  confirmed_by_citizen boolean,
  citizen_confirmation_date timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.submitted_by,
    c.title,
    'complaint'::text as type,
    c.subtype,
    c.descriptive_su,
    c.location_text,
    c.latitude,
    c.longitude,
    c.department_r,
    get_complaint_status(c.workflow_status) as status,
    c.workflow_status,
    c.priority,
    get_primary_department(c.department_r) as primary_department,
    get_secondary_departments(c.department_r) as secondary_departments,
    c.assigned_coordinator_id,
    c.response_deadline,
    c.citizen_satisfaction_rating,
    c.is_duplicate,
    c.master_complaint_id,
    c.task_force_id,
    c.coordinator_notes,
    c.estimated_resolution_date,
    c.submitted_at,
    c.updated_at,
    c.cancelled_at,
    c.cancellation_reason,
    c.cancelled_by,
    c.last_activity_at,
    c.preferred_departments,
    c.resolution_notes,
    c.resolved_by,
    c.resolved_at,
    c.confirmed_by_citizen,
    c.citizen_confirmation_date
  FROM public.complaints c
  WHERE c.id = complaint_id;
END;
$$ LANGUAGE plpgsql;

-- Migration completed successfully
-- The following fields have been removed:
-- - type (always 'complaint')
-- - status (derived from workflow_status)
-- - primary_department (derived from department_r[0])
-- - secondary_departments (derived from department_r[1:])
-- - evidence (use complaint_evidence table instead)










