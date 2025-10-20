-- Row-Level Security (RLS) Policies for CitizenLink Database
-- This script enables RLS and creates policies for the three tables mentioned

-- ==============================================
-- 1. ENABLE RLS ON TABLES
-- ==============================================

-- Enable RLS on categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Enable RLS on subcategories table  
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Enable RLS on department_subcategory_mapping table
ALTER TABLE public.department_subcategory_mapping ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 2. CATEGORIES TABLE POLICIES
-- ==============================================

-- Policy: Allow all authenticated users to read active categories
CREATE POLICY "Allow authenticated users to read active categories" 
ON public.categories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy: Allow super-admin and lgu-admin to read all categories (including inactive)
CREATE POLICY "Allow admins to read all categories" 
ON public.categories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
);

-- Policy: Allow super-admin and lgu-admin to insert categories
CREATE POLICY "Allow admins to insert categories" 
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
);

-- Policy: Allow super-admin and lgu-admin to update categories
CREATE POLICY "Allow admins to update categories" 
ON public.categories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
);

-- Policy: Allow only super-admin to delete categories
CREATE POLICY "Allow super-admin to delete categories" 
ON public.categories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'super-admin'
  )
);

-- ==============================================
-- 3. SUBCATEGORIES TABLE POLICIES
-- ==============================================

-- Policy: Allow all authenticated users to read active subcategories
CREATE POLICY "Allow authenticated users to read active subcategories" 
ON public.subcategories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy: Allow super-admin and lgu-admin to read all subcategories (including inactive)
CREATE POLICY "Allow admins to read all subcategories" 
ON public.subcategories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
);

-- Policy: Allow super-admin and lgu-admin to insert subcategories
CREATE POLICY "Allow admins to insert subcategories" 
ON public.subcategories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
);

-- Policy: Allow super-admin and lgu-admin to update subcategories
CREATE POLICY "Allow admins to update subcategories" 
ON public.subcategories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
);

-- Policy: Allow only super-admin to delete subcategories
CREATE POLICY "Allow super-admin to delete subcategories" 
ON public.subcategories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'super-admin'
  )
);

-- ==============================================
-- 4. DEPARTMENT_SUBCATEGORY_MAPPING TABLE POLICIES
-- ==============================================

-- Policy: Allow all authenticated users to read department-subcategory mappings
CREATE POLICY "Allow authenticated users to read department-subcategory mappings" 
ON public.department_subcategory_mapping
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow super-admin and lgu-admin to insert department-subcategory mappings
CREATE POLICY "Allow admins to insert department-subcategory mappings" 
ON public.department_subcategory_mapping
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
);

-- Policy: Allow super-admin and lgu-admin to update department-subcategory mappings
CREATE POLICY "Allow admins to update department-subcategory mappings" 
ON public.department_subcategory_mapping
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  )
);

-- Policy: Allow only super-admin to delete department-subcategory mappings
CREATE POLICY "Allow super-admin to delete department-subcategory mappings" 
ON public.department_subcategory_mapping
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'super-admin'
  )
);

-- ==============================================
-- 5. ADDITIONAL HELPER FUNCTIONS (Optional)
-- ==============================================

-- Function to check if user is admin (can be used in policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND (
      auth.users.raw_user_meta_data->>'role' = 'super-admin' OR
      auth.users.raw_user_meta_data->>'role' LIKE 'lgu-admin%'
    )
  );
$$;

-- Function to check if user is super-admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'super-admin'
  );
$$;

-- ==============================================
-- 6. VERIFICATION QUERIES
-- ==============================================

-- Check if RLS is enabled on the tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('categories', 'subcategories', 'department_subcategory_mapping')
AND schemaname = 'public';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('categories', 'subcategories', 'department_subcategory_mapping')
AND schemaname = 'public'
ORDER BY tablename, policyname;
