-- Drop public_content table
-- Date: 2025-10-17

-- Drop any policies on the table first
DROP POLICY IF EXISTS "Public can view content" ON public.public_content;
DROP POLICY IF EXISTS "Admins can manage content" ON public.public_content;

-- Drop the table
DROP TABLE IF EXISTS public.public_content CASCADE;

-- Confirmation
SELECT 'public_content table dropped successfully' AS status;
