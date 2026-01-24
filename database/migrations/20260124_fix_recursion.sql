-- Fix Infinite Recursion in user_profiles RLS
-- The error "infinite recursion detected" happens when a Policy on user_profiles queries user_profiles itself (internal loop).
-- Solution: Use a SECURITY DEFINER function to bypass RLS for the admin check.

-- 1. Create Safe Admin Check Function
CREATE OR REPLACE FUNCTION public.check_is_admin_safe()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Critical: Bypasses RLS
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin', 'coordinator', 'lgu-admin', 'complaint-coordinator')
  );
$$;

-- 2. Drop Existing Policies (to clear the bad ones)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin View All" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

-- 3. Recreate Policies safely

-- A. Users see their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- B. Admins see all profiles (Using the safe function)
CREATE POLICY "Admins and Coordinators can view all" ON public.user_profiles
FOR SELECT
USING (check_is_admin_safe());

-- C. Update/Insert Policies (Standard)
CREATE POLICY "Users can update own profile" ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id);
