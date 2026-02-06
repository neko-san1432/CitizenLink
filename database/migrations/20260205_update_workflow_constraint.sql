-- Migration to update workflow_status constraint to support new 5-phase system
-- Old values: new, assigned, in_progress, pending_approval, completed, cancelled
-- New values: submitted, verified, under_review, action_taken, resolved

-- 1. DROP the existing constraint first so we can update values
ALTER TABLE public.complaints
DROP CONSTRAINT IF EXISTS complaints_workflow_status_check;

-- 2. MIGRATE existing data to new statuses
-- 'new' -> 'submitted'
UPDATE public.complaints SET workflow_status = 'submitted' WHERE workflow_status = 'new';
-- 'assigned' -> 'verified' (Assumes assignment implies verification)
UPDATE public.complaints SET workflow_status = 'verified' WHERE workflow_status = 'assigned';
-- 'in_progress' -> 'under_review' (Active work/review)
UPDATE public.complaints SET workflow_status = 'under_review' WHERE workflow_status = 'in_progress';
-- 'pending_approval' -> 'action_taken' (Work done, waiting for signoff)
UPDATE public.complaints SET workflow_status = 'action_taken' WHERE workflow_status = 'pending_approval';
-- 'completed' -> 'resolved'
UPDATE public.complaints SET workflow_status = 'resolved' WHERE workflow_status = 'completed';
-- 'cancelled' -> 'resolved' (Treating as closed)
UPDATE public.complaints SET workflow_status = 'resolved' WHERE workflow_status = 'cancelled';

-- 3. ADD the new constraint
ALTER TABLE public.complaints
ADD CONSTRAINT complaints_workflow_status_check
CHECK (workflow_status = ANY (ARRAY[
  'submitted'::text,
  'verified'::text,
  'under_review'::text,
  'action_taken'::text,
  'resolved'::text
]));

-- 4. Update default value
ALTER TABLE public.complaints
ALTER COLUMN workflow_status SET DEFAULT 'submitted'::text;

-- Comment describing the phases
COMMENT ON COLUMN public.complaints.workflow_status IS 'Current phase: submitted -> verified -> under_review -> action_taken -> resolved';
