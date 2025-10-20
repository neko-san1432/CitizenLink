-- Row-Level Security (RLS) Policies for CitizenLink Database - Optimized Version
-- This script enables RLS and creates policies for the three tables mentioned

-- ==============================================
-- 1. HELPER FUNCTIONS (Create first)
-- ==============================================

-- Function to check if user is admin (super-admin or lgu-admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
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
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'super-admin'
  );
$$;

-- ==============================================
-- 2. ENABLE RLS ON TABLES
-- ==============================================

-- Enable RLS on categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Enable RLS on subcategories table  
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Enable RLS on department_subcategory_mapping table
ALTER TABLE public.department_subcategory_mapping ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 3. CATEGORIES TABLE POLICIES
-- ==============================================

-- Policy: Allow all authenticated users to read active categories
CREATE POLICY "categories_select_active" 
ON public.categories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy: Allow admins to read all categories (including inactive)
CREATE POLICY "categories_select_admin" 
ON public.categories
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Policy: Allow admins to insert categories
CREATE POLICY "categories_insert_admin" 
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Policy: Allow admins to update categories
CREATE POLICY "categories_update_admin" 
ON public.categories
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy: Allow only super-admin to delete categories
CREATE POLICY "categories_delete_super_admin" 
ON public.categories
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ==============================================
-- 4. SUBCATEGORIES TABLE POLICIES
-- ==============================================

-- Policy: Allow all authenticated users to read active subcategories
CREATE POLICY "subcategories_select_active" 
ON public.subcategories
FOR SELECT
TO authenticated
USING (is_active = true);

-- Policy: Allow admins to read all subcategories (including inactive)
CREATE POLICY "subcategories_select_admin" 
ON public.subcategories
FOR SELECT
TO authenticated
USING (public.is_admin());

-- Policy: Allow admins to insert subcategories
CREATE POLICY "subcategories_insert_admin" 
ON public.subcategories
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Policy: Allow admins to update subcategories
CREATE POLICY "subcategories_update_admin" 
ON public.subcategories
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy: Allow only super-admin to delete subcategories
CREATE POLICY "subcategories_delete_super_admin" 
ON public.subcategories
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ==============================================
-- 5. DEPARTMENT_SUBCATEGORY_MAPPING TABLE POLICIES
-- ==============================================

-- Policy: Allow all authenticated users to read department-subcategory mappings
CREATE POLICY "department_subcategory_mapping_select_all" 
ON public.department_subcategory_mapping
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow admins to insert department-subcategory mappings
CREATE POLICY "department_subcategory_mapping_insert_admin" 
ON public.department_subcategory_mapping
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Policy: Allow admins to update department-subcategory mappings
CREATE POLICY "department_subcategory_mapping_update_admin" 
ON public.department_subcategory_mapping
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy: Allow only super-admin to delete department-subcategory mappings
CREATE POLICY "department_subcategory_mapping_delete_super_admin" 
ON public.department_subcategory_mapping
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ==============================================
-- 6. GRANT NECESSARY PERMISSIONS
-- ==============================================

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant select permissions on the tables to authenticated users
GRANT SELECT ON public.categories TO authenticated;
GRANT SELECT ON public.subcategories TO authenticated;
GRANT SELECT ON public.department_subcategory_mapping TO authenticated;

-- Grant all permissions to admins (they will be controlled by RLS policies)
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.subcategories TO authenticated;
GRANT ALL ON public.department_subcategory_mapping TO authenticated;

-- ==============================================
-- 7. VERIFICATION QUERIES
-- ==============================================

-- Check if RLS is enabled on the tables
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as "RLS Enabled",
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled' 
    ELSE '❌ RLS Disabled' 
  END as status
FROM pg_tables 
WHERE tablename IN ('categories', 'subcategories', 'department_subcategory_mapping')
AND schemaname = 'public'
ORDER BY tablename;

-- Check existing policies
SELECT 
  tablename,
  policyname,
  cmd as "Command",
  permissive as "Permissive",
  CASE 
    WHEN cmd = 'SELECT' THEN '🔍 Read'
    WHEN cmd = 'INSERT' THEN '➕ Create'
    WHEN cmd = 'UPDATE' THEN '✏️ Update'
    WHEN cmd = 'DELETE' THEN '🗑️ Delete'
    ELSE cmd
  END as "Action"
FROM pg_policies 
WHERE tablename IN ('categories', 'subcategories', 'department_subcategory_mapping')
AND schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- Test the helper functions (run as authenticated user)
-- SELECT public.is_admin() as "Is Admin", public.is_super_admin() as "Is Super Admin";
