-- Migration: Remove primary department hierarchy
-- Make all departments equal in the complaint workflow

-- Remove is_primary column from department_subcategory_mapping
ALTER TABLE public.department_subcategory_mapping 
DROP COLUMN IF EXISTS is_primary;

-- Update response_priority to be the only ranking mechanism
-- (1 = highest priority, 2 = second priority, etc.)
-- All departments are now equal, only response order matters

-- Add comment to clarify the new approach
COMMENT ON TABLE public.department_subcategory_mapping IS 'Maps departments to subcategories with response priority order. All departments are equal, only response order matters.';

-- Update existing data to remove primary designations
-- Keep response_priority for ordering but remove primary hierarchy
UPDATE public.department_subcategory_mapping 
SET response_priority = 1 
WHERE response_priority IS NULL;

-- Add index for response_priority for better performance
CREATE INDEX IF NOT EXISTS idx_department_subcategory_mapping_response_priority 
ON public.department_subcategory_mapping(response_priority);

-- Add comment explaining the new equal approach
COMMENT ON COLUMN public.department_subcategory_mapping.response_priority IS 'Response priority order (1=first, 2=second, etc.). All departments are equal, only order matters.';
