-- Migration to optimize complaints table by removing redundant fields
-- This migration handles RLS policy dependencies properly

-- Step 1: Create a view that provides backward compatibility for status
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
  -- Derive status from workflow_status for backward compatibility
  CASE 
    WHEN workflow_status = 'new' THEN 'pending review'
    WHEN workflow_status = 'assigned' THEN 'in progress'
    WHEN workflow_status = 'in_progress' THEN 'in progress'
    WHEN workflow_status = 'pending_approval' THEN 'in progress'
    WHEN workflow_status = 'completed' THEN 'resolved'
    WHEN workflow_status = 'cancelled' THEN 'rejected'
    ELSE 'pending review'
  END as status,
  workflow_status,
  priority,
  -- Derive primary_department from department_r array
  CASE 
    WHEN array_length(department_r, 1) > 0 THEN department_r[1]
    ELSE NULL
  END as primary_department,
  -- Derive secondary_departments from department_r array
  CASE 
    WHEN array_length(department_r, 1) > 1 THEN department_r[2:]
    ELSE '{}'::text[]
  END as secondary_departments,
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

-- Step 2: Drop existing RLS policies that depend on status column
-- (We'll recreate them to use workflow_status instead)

-- First, let's check what policies exist
DO $$
DECLARE
    policy_name text;
BEGIN
    -- Get all policies on complaints table
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'complaints' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.complaints', policy_name);
    END LOOP;
END $$;

-- Step 3: Recreate RLS policies using workflow_status instead of status
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

-- Policy: Citizens can insert their own complaints
CREATE POLICY "Citizens can insert own complaints" ON public.complaints
  FOR INSERT WITH CHECK (submitted_by = auth.uid());

-- Policy: Coordinators can view all complaints
CREATE POLICY "Coordinators can view all complaints" ON public.complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('complaint-coordinator', 'super-admin', 'lgu-admin', 'lgu-officer'))
    )
  );

-- Policy: Coordinators can update all complaints
CREATE POLICY "Coordinators can update all complaints" ON public.complaints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('complaint-coordinator', 'super-admin', 'lgu-admin', 'lgu-officer'))
    )
  );

-- Policy: LGU Admins can view complaints for their departments
CREATE POLICY "LGU Admins can view department complaints" ON public.complaints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' = 'lgu-admin')
      AND (
        -- Check if any department in department_r matches user's department
        EXISTS (
          SELECT 1 FROM unnest(department_r) as dept_code
          WHERE dept_code = (raw_user_meta_data->>'department')
        )
        OR primary_department = (raw_user_meta_data->>'department')
      )
    )
  );

-- Step 4: Now we can safely drop the redundant columns
-- (This will be done in a separate migration to avoid issues)

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_complaints_workflow_status ON complaints(workflow_status);
CREATE INDEX IF NOT EXISTS idx_complaints_department_r ON complaints USING GIN(department_r);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_by ON complaints(submitted_by);
CREATE INDEX IF NOT EXISTS idx_complaints_last_activity ON complaints(last_activity_at);

-- Step 6: Create a function to automatically update last_activity_at
CREATE OR REPLACE FUNCTION update_complaint_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update last_activity_at
DROP TRIGGER IF EXISTS trigger_update_complaint_last_activity ON complaints;
CREATE TRIGGER trigger_update_complaint_last_activity
  BEFORE UPDATE ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION update_complaint_last_activity();

-- Step 7: Add comments for documentation
COMMENT ON VIEW complaint_status_view IS 'Backward compatibility view for complaints with derived status field';
COMMENT ON COLUMN complaints.workflow_status IS 'Primary status field - use this instead of the old status field';
COMMENT ON COLUMN complaints.department_r IS 'Array of department codes - primary department is department_r[1]';
