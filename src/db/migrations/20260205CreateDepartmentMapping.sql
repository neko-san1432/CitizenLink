-- Create department_subcategory_mapping table
-- This table was missing but referenced in the backend code
-- It handles the Many-to-Many relationship between departments and Subcategories

CREATE TABLE IF NOT EXISTS public.department_subcategory_mapping (
    department_id bigint NOT NULL,
    subcategory_id uuid NOT NULL,
    response_priority integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    
    -- Composite Primary Key
    CONSTRAINT department_subcategory_mapping_pkey PRIMARY KEY (department_id, subcategory_id),
    
    -- Foreign Keys
    CONSTRAINT mapping_department_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
    CONSTRAINT mapping_subcategory_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_dept_sub_mapping_sub_id ON public.department_subcategory_mapping(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_dept_sub_mapping_dept_id ON public.department_subcategory_mapping(department_id);

-- Add comments
COMMENT ON TABLE public.department_subcategory_mapping IS 'Junction table for department-Subcategory M2M relationship';
COMMENT ON COLUMN public.department_subcategory_mapping.response_priority IS 'Ordering for department display (lower = higher priority)';
