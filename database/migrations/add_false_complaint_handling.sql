-- Migration: Add false complaint handling fields to complaints table
-- This migration adds fields to track false complaints and their reasons

-- Add false complaint fields to complaints table
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS is_false_complaint boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS false_complaint_reason text,
ADD COLUMN IF NOT EXISTS false_complaint_marked_by uuid,
ADD COLUMN IF NOT EXISTS false_complaint_marked_at timestamp with time zone;

-- Add foreign key for false_complaint_marked_by
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'complaints_false_complaint_marked_by_fkey'
  ) THEN
    ALTER TABLE public.complaints 
    ADD CONSTRAINT complaints_false_complaint_marked_by_fkey 
    FOREIGN KEY (false_complaint_marked_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- Add new workflow status for false complaints
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'complaints_workflow_status_check'
  ) THEN
    ALTER TABLE public.complaints 
    DROP CONSTRAINT complaints_workflow_status_check;
  END IF;
  
  -- Add new constraint with rejected_false status
  ALTER TABLE public.complaints 
  ADD CONSTRAINT complaints_workflow_status_check 
  CHECK (workflow_status = ANY (ARRAY[
    'new'::text, 
    'assigned'::text, 
    'in_progress'::text, 
    'pending_approval'::text, 
    'completed'::text, 
    'cancelled'::text,
    'rejected_false'::text  -- NEW: For false complaints
  ]));
END $$;

-- Add index for false complaints
CREATE INDEX IF NOT EXISTS idx_complaints_is_false_complaint 
ON public.complaints(is_false_complaint) WHERE is_false_complaint = true;

-- Add index for false complaint marked by
CREATE INDEX IF NOT EXISTS idx_complaints_false_complaint_marked_by 
ON public.complaints(false_complaint_marked_by) WHERE false_complaint_marked_by IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.complaints.is_false_complaint IS 'Flag indicating this complaint was determined to be false or fraudulent';
COMMENT ON COLUMN public.complaints.false_complaint_reason IS 'Reason why complaint was marked as false';
COMMENT ON COLUMN public.complaints.false_complaint_marked_by IS 'Coordinator who marked the complaint as false';
COMMENT ON COLUMN public.complaints.false_complaint_marked_at IS 'Timestamp when complaint was marked as false';

-- Create function to automatically update false_complaint_marked_at when is_false_complaint is set to true
CREATE OR REPLACE FUNCTION update_false_complaint_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- If is_false_complaint is being set to true and marked_at is null, set it to now
  IF NEW.is_false_complaint = true AND (OLD.is_false_complaint IS NULL OR OLD.is_false_complaint = false) AND NEW.false_complaint_marked_at IS NULL THEN
    NEW.false_complaint_marked_at = NOW();
  END IF;
  
  -- If is_false_complaint is being set to false, clear the timestamp
  IF NEW.is_false_complaint = false AND OLD.is_false_complaint = true THEN
    NEW.false_complaint_marked_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_false_complaint_timestamp'
  ) THEN
    CREATE TRIGGER trigger_update_false_complaint_timestamp
      BEFORE UPDATE ON public.complaints
      FOR EACH ROW
      EXECUTE FUNCTION update_false_complaint_timestamp();
  END IF;
END $$;

