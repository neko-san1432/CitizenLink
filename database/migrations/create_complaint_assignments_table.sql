-- Migration: Create complaint_assignments table
-- This table tracks assignments of complaints to LGU officers

-- Create complaint_assignments table
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled')),
    priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    notes text,
    deadline timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    updated_by uuid
);

-- Add foreign key constraints
ALTER TABLE public.complaint_assignments 
    ADD CONSTRAINT fk_complaint_assignments_complaint_id 
    FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_assignments 
    ADD CONSTRAINT fk_complaint_assignments_assigned_to 
    FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_assignments 
    ADD CONSTRAINT fk_complaint_assignments_assigned_by 
    FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.complaint_assignments 
    ADD CONSTRAINT fk_complaint_assignments_updated_by 
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_complaint_id ON public.complaint_assignments(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_assigned_to ON public.complaint_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_status ON public.complaint_assignments(status);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_created_at ON public.complaint_assignments(created_at);

-- Add RLS policies
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Officers can view their own assignments
CREATE POLICY "Officers can view own assignments" ON public.complaint_assignments
    FOR SELECT USING (assigned_to = auth.uid());

-- Policy: Admins can view all assignments
CREATE POLICY "Admins can view all assignments" ON public.complaint_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin', 'complaint-coordinator'))
        )
    );

-- Policy: Officers can update their own assignments
CREATE POLICY "Officers can update own assignments" ON public.complaint_assignments
    FOR UPDATE USING (assigned_to = auth.uid());

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_complaint_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_complaint_assignments_updated_at
    BEFORE UPDATE ON public.complaint_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_complaint_assignments_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.complaint_assignments IS 'Tracks assignments of complaints to LGU officers';
COMMENT ON COLUMN public.complaint_assignments.complaint_id IS 'Reference to the complaint being assigned';
COMMENT ON COLUMN public.complaint_assignments.assigned_to IS 'LGU officer assigned to handle the complaint';
COMMENT ON COLUMN public.complaint_assignments.assigned_by IS 'Admin who made the assignment';
COMMENT ON COLUMN public.complaint_assignments.status IS 'Current status of the assignment';
COMMENT ON COLUMN public.complaint_assignments.priority IS 'Priority level of the assignment';
COMMENT ON COLUMN public.complaint_assignments.notes IS 'Additional notes about the assignment';
COMMENT ON COLUMN public.complaint_assignments.deadline IS 'Deadline for completing the assignment';
