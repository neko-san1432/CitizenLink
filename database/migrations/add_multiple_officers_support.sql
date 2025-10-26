-- Migration: Add Multiple Officers Support to Complaint Assignments
-- This migration modifies the complaint_assignments table to support multiple officers per complaint

-- First, let's check if we need to backup existing data
-- (In production, you'd want to backup the table first)

-- Add a new field to track if this is a multi-officer assignment
ALTER TABLE complaint_assignments 
ADD COLUMN IF NOT EXISTS assignment_type TEXT DEFAULT 'single' CHECK (assignment_type IN ('single', 'multi'));

-- Add a field to group multiple assignments for the same complaint
ALTER TABLE complaint_assignments 
ADD COLUMN IF NOT EXISTS assignment_group_id UUID DEFAULT uuid_generate_v4();

-- Add a field to track the order/priority within a multi-officer assignment
ALTER TABLE complaint_assignments 
ADD COLUMN IF NOT EXISTS officer_order INTEGER DEFAULT 1;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_group_id 
ON complaint_assignments(assignment_group_id);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_type 
ON complaint_assignments(assignment_type);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_complaint_group 
ON complaint_assignments(complaint_id, assignment_group_id);

-- Update existing single assignments to have unique group IDs
UPDATE complaint_assignments 
SET assignment_group_id = uuid_generate_v4() 
WHERE assignment_group_id IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN complaint_assignments.assignment_type IS 'Type of assignment: single or multi-officer';
COMMENT ON COLUMN complaint_assignments.assignment_group_id IS 'Groups multiple assignments for the same complaint';
COMMENT ON COLUMN complaint_assignments.officer_order IS 'Order/priority of officer within multi-officer assignment';

-- Create a view for easier querying of assignments
CREATE OR REPLACE VIEW complaint_assignments_view AS
SELECT 
    ca.*,
    c.title as complaint_title,
    c.description as complaint_description,
    c.location_text as complaint_location,
    c.submitted_at as complaint_submitted_at,
    c.priority as complaint_priority,
    c.workflow_status as complaint_status,
    -- Officer information
    au.name as officer_name,
    au.email as officer_email,
    au.raw_user_meta_data->>'mobile_number' as officer_phone,
    au.raw_user_meta_data->>'employee_id' as officer_employee_id,
    -- Assigner information
    assigner.name as assigned_by_name,
    assigner.email as assigned_by_email,
    -- Assignment group summary
    (SELECT COUNT(*) FROM complaint_assignments ca2 
     WHERE ca2.assignment_group_id = ca.assignment_group_id) as total_officers_in_group
FROM complaint_assignments ca
LEFT JOIN complaints c ON ca.complaint_id = c.id
LEFT JOIN auth.users au ON ca.assigned_to_officer_id = au.id
LEFT JOIN auth.users assigner ON ca.assigned_by_lgu_admin_id = assigner.id
ORDER BY ca.complaint_id, ca.assignment_group_id, ca.officer_order;

-- Add RLS policies for the view
ALTER VIEW complaint_assignments_view SET (security_invoker = true);

-- Create a function to get assignment groups for a complaint
CREATE OR REPLACE FUNCTION get_complaint_assignment_groups(complaint_uuid UUID)
RETURNS TABLE (
    assignment_group_id UUID,
    total_officers INTEGER,
    assignment_type TEXT,
    priority TEXT,
    deadline TIMESTAMPTZ,
    notes TEXT,
    assigned_at TIMESTAMPTZ,
    assigned_by_name TEXT,
    officers JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.assignment_group_id,
        COUNT(*)::INTEGER as total_officers,
        ca.assignment_type,
        ca.priority,
        ca.response_deadline as deadline,
        ca.notes,
        ca.assigned_at,
        assigner.name as assigned_by_name,
        jsonb_agg(
            jsonb_build_object(
                'officer_id', ca.assigned_to_officer_id,
                'officer_name', au.name,
                'officer_email', au.email,
                'officer_phone', au.raw_user_meta_data->>'mobile_number',
                'employee_id', au.raw_user_meta_data->>'employee_id',
                'order', ca.officer_order,
                'status', ca.status
            ) ORDER BY ca.officer_order
        ) as officers
    FROM complaint_assignments ca
    LEFT JOIN auth.users au ON ca.assigned_to_officer_id = au.id
    LEFT JOIN auth.users assigner ON ca.assigned_by_lgu_admin_id = assigner.id
    WHERE ca.complaint_id = complaint_uuid
    GROUP BY ca.assignment_group_id, ca.assignment_type, ca.priority, ca.response_deadline, ca.notes, ca.assigned_at, assigner.name
    ORDER BY ca.assigned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_complaint_assignment_groups(UUID) TO authenticated;
GRANT SELECT ON complaint_assignments_view TO authenticated;

-- Add comments
COMMENT ON FUNCTION get_complaint_assignment_groups(UUID) IS 'Returns grouped assignment information for a complaint';
COMMENT ON VIEW complaint_assignments_view IS 'Enhanced view of complaint assignments with related data';
