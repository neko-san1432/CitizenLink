-- Quick RLS Setup for CitizenLink Database
-- Run this script to enable RLS on the three tables

-- ==============================================
-- STEP 1: Create Helper Functions
-- ==============================================

-- Function to check if user is admin
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
-- STEP 2: Enable RLS
-- ==============================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_subcategory_mapping ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- STEP 3: Create Policies for CATEGORIES
-- ==============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "categories_select_active" ON public.categories;
DROP POLICY IF EXISTS "categories_select_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_super_admin" ON public.categories;

-- Create new policies
CREATE POLICY "categories_select_active" 
ON public.categories FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "categories_select_admin" 
ON public.categories FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "categories_insert_admin" 
ON public.categories FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "categories_update_admin" 
ON public.categories FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "categories_delete_super_admin" 
ON public.categories FOR DELETE TO authenticated
USING (public.is_super_admin());

-- ==============================================
-- STEP 4: Create Policies for SUBCATEGORIES
-- ==============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "subcategories_select_active" ON public.subcategories;
DROP POLICY IF EXISTS "subcategories_select_admin" ON public.subcategories;
DROP POLICY IF EXISTS "subcategories_insert_admin" ON public.subcategories;
DROP POLICY IF EXISTS "subcategories_update_admin" ON public.subcategories;
DROP POLICY IF EXISTS "subcategories_delete_super_admin" ON public.subcategories;

-- Create new policies
CREATE POLICY "subcategories_select_active" 
ON public.subcategories FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "subcategories_select_admin" 
ON public.subcategories FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "subcategories_insert_admin" 
ON public.subcategories FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "subcategories_update_admin" 
ON public.subcategories FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "subcategories_delete_super_admin" 
ON public.subcategories FOR DELETE TO authenticated
USING (public.is_super_admin());

-- ==============================================
-- STEP 5: Create Policies for DEPARTMENT_SUBCATEGORY_MAPPING
-- ==============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "department_subcategory_mapping_select_all" ON public.department_subcategory_mapping;
DROP POLICY IF EXISTS "department_subcategory_mapping_insert_admin" ON public.department_subcategory_mapping;
DROP POLICY IF EXISTS "department_subcategory_mapping_update_admin" ON public.department_subcategory_mapping;
DROP POLICY IF EXISTS "department_subcategory_mapping_delete_super_admin" ON public.department_subcategory_mapping;

-- Create new policies
CREATE POLICY "department_subcategory_mapping_select_all" 
ON public.department_subcategory_mapping FOR SELECT TO authenticated
USING (true);

CREATE POLICY "department_subcategory_mapping_insert_admin" 
ON public.department_subcategory_mapping FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "department_subcategory_mapping_update_admin" 
ON public.department_subcategory_mapping FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "department_subcategory_mapping_delete_super_admin" 
ON public.department_subcategory_mapping FOR DELETE TO authenticated
USING (public.is_super_admin());

-- ==============================================
-- STEP 6: Grant Permissions
-- ==============================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT ALL ON public.subcategories TO authenticated;
GRANT ALL ON public.department_subcategory_mapping TO authenticated;

-- ==============================================
-- STEP 7: Verification
-- ==============================================

-- Check RLS status
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled' 
    ELSE '❌ RLS Disabled' 
  END as status
FROM pg_tables 
WHERE tablename IN ('categories', 'subcategories', 'department_subcategory_mapping')
AND schemaname = 'public'
ORDER BY tablename;

-- Count policies per table
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('categories', 'subcategories', 'department_subcategory_mapping')
AND schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Show all policies
SELECT 
  tablename,
  policyname,
  cmd as command,
  CASE 
    WHEN cmd = 'SELECT' THEN '🔍 Read'
    WHEN cmd = 'INSERT' THEN '➕ Create'
    WHEN cmd = 'UPDATE' THEN '✏️ Update'
    WHEN cmd = 'DELETE' THEN '🗑️ Delete'
  END as action
FROM pg_policies 
WHERE tablename IN ('categories', 'subcategories', 'department_subcategory_mapping')
AND schemaname = 'public'
ORDER BY tablename, cmd;
