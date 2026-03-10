-- EMERGENCY FIX: Infinite Recursion in user_profiles
-- This script drops properly recreates the admin check function and policies to avoid recursion.

-- 1. Drop existing policies to be safe
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin View All" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins and Coordinators can view all" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- 2. Create optimized security DEFINER function to check admin status
-- security DEFINER allows this function to run with the privileges of the creator (postgres/superuser),
-- bypassing RLS on user_profiles within the function itself.
CREATE OR REPLACE FUNCTION public.check_is_admin_safe()
RETURNS boolean
LANGUAGE sql
security DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
$$;

-- 3. Re-enable RLS (just in case)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL security;

-- 4. Create Non-Recursive Policies

-- A. Users can view their own profile (Direct ID check, no recursion)
CREATE POLICY "Users can view own profile" ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- B. Admins can view all profiles (Uses the SAFE function)
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
FOR SELECT
USING (check_is_admin_safe());

-- C. Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id);

-- D. Insert policy (usually handled by triggers on auth.users, but good to have)
CREATE POLICY "Users can insert own profile" ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);
