-- Add status column to complaints table
-- This column will track the current status of complaints (pending, assigned, in_progress, resolved, rejected, etc.)

ALTER TABLE public.complaints 
ADD COLUMN status VARCHAR(50) DEFAULT 'pending';

-- Add index for better query performance
CREATE INDEX idx_complaints_status ON public.complaints(status);

-- Update existing complaints to have a default status based on their workflow_status
UPDATE public.complaints 
SET status = CASE 
    WHEN workflow_status = 'submitted' THEN 'pending'
    WHEN workflow_status = 'assigned' THEN 'assigned'
    WHEN workflow_status = 'in_progress' THEN 'in_progress'
    WHEN workflow_status = 'resolved' THEN 'resolved'
    WHEN workflow_status = 'rejected' THEN 'rejected'
    WHEN workflow_status = 'closed' THEN 'closed'
    ELSE 'pending'
END;

-- Add comment to document the column
COMMENT ON COLUMN public.complaints.status IS 'Current status of the complaint (pending, assigned, in_progress, resolved, rejected, closed)';

