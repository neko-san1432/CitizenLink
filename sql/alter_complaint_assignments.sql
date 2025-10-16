-- ============================================================================
-- Alter complaint_assignments Table
-- Add missing columns for priority, deadline, and completion tracking
-- ============================================================================

-- Add priority column
ALTER TABLE public.complaint_assignments 
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Add deadline column
ALTER TABLE public.complaint_assignments 
  ADD COLUMN IF NOT EXISTS deadline timestamp with time zone;

-- Add completed_at column
ALTER TABLE public.complaint_assignments 
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Create index on priority for filtering
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_priority ON public.complaint_assignments(priority);

-- Create index on deadline for sorting/filtering
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_deadline ON public.complaint_assignments(deadline);

-- Comment
COMMENT ON COLUMN public.complaint_assignments.priority IS 'Task priority level: low, medium, high, urgent';
COMMENT ON COLUMN public.complaint_assignments.deadline IS 'Expected completion deadline';
COMMENT ON COLUMN public.complaint_assignments.completed_at IS 'Timestamp when assignment was marked as completed';


