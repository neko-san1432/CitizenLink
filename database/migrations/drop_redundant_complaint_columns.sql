-- Second part of complaints table optimization
-- This drops the redundant columns after RLS policies have been updated

-- Step 1: Drop redundant columns
ALTER TABLE public.complaints 
  DROP COLUMN IF EXISTS status,  -- Now derived from workflow_status
  DROP COLUMN IF EXISTS primary_department,  -- Now derived from department_r[1]
  DROP COLUMN IF EXISTS secondary_departments,  -- Now derived from department_r[2:]
  DROP COLUMN IF EXISTS evidence;  -- Use complaint_evidence table instead

-- Step 2: Add constraints to ensure data integrity
-- Ensure department_r is not empty when complaint is created
ALTER TABLE public.complaints 
  ADD CONSTRAINT check_department_r_not_empty 
  CHECK (array_length(department_r, 1) > 0);

-- Step 3: Create helper functions for common queries
-- Function to get primary department from department_r array
CREATE OR REPLACE FUNCTION get_primary_department(complaint_row complaints)
RETURNS text AS $$
BEGIN
  RETURN CASE 
    WHEN array_length(complaint_row.department_r, 1) > 0 THEN complaint_row.department_r[1]
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get secondary departments from department_r array
CREATE OR REPLACE FUNCTION get_secondary_departments(complaint_row complaints)
RETURNS text[] AS $$
BEGIN
  RETURN CASE 
    WHEN array_length(complaint_row.department_r, 1) > 1 THEN complaint_row.department_r[2:]
    ELSE '{}'::text[]
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get status from workflow_status
CREATE OR REPLACE FUNCTION get_status_from_workflow(complaint_row complaints)
RETURNS text AS $$
BEGIN
  RETURN CASE 
    WHEN complaint_row.workflow_status = 'new' THEN 'pending review'
    WHEN complaint_row.workflow_status = 'assigned' THEN 'in progress'
    WHEN complaint_row.workflow_status = 'in_progress' THEN 'in progress'
    WHEN complaint_row.workflow_status = 'pending_approval' THEN 'in progress'
    WHEN complaint_row.workflow_status = 'completed' THEN 'resolved'
    WHEN complaint_row.workflow_status = 'cancelled' THEN 'rejected'
    ELSE 'pending review'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Update the view to use the helper functions
CREATE OR REPLACE VIEW complaint_status_view AS
SELECT 
  id,
  submitted_by,
  title,
  type,
  subtype,
  descriptive_su,
  location_text,
  latitude,
  longitude,
  department_r,
  get_status_from_workflow(complaints.*) as status,
  workflow_status,
  priority,
  get_primary_department(complaints.*) as primary_department,
  get_secondary_departments(complaints.*) as secondary_departments,
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
FROM complaints;

-- Step 5: Add comments for documentation
COMMENT ON FUNCTION get_primary_department(complaints) IS 'Gets the primary department from department_r array';
COMMENT ON FUNCTION get_secondary_departments(complaints) IS 'Gets secondary departments from department_r array';
COMMENT ON FUNCTION get_status_from_workflow(complaints) IS 'Converts workflow_status to legacy status format';

-- Step 6: Create a migration log entry
INSERT INTO public.settings (key, value, type, category, description) 
VALUES (
  'complaints_table_optimized', 
  'true', 
  'boolean', 
  'database', 
  'Complaints table has been optimized by removing redundant status, primary_department, secondary_departments, and evidence columns'
) ON CONFLICT (key) DO UPDATE SET 
  value = 'true',
  updated_at = now();
