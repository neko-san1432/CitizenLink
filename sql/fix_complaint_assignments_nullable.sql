-- ============================================================================
-- Make department_id nullable in complaint_assignments
-- We track departments via text codes in complaints table
-- ============================================================================

ALTER TABLE public.complaint_assignments 
  ALTER COLUMN department_id DROP NOT NULL;
    
-- Comment
COMMENT ON COLUMN public.complaint_assignments.department_id IS 'Optional department reference - assignments can be direct to officers';


