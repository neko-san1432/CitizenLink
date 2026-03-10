-- =============================================================================
-- FIX: Infinite Recursion in complaints table RLS policies
-- Date: 2026-02-24
-- Error: "infinite recursion detected in policy for relation 'complaints'" (42P17)
--
-- The same pattern that fixed user_profiles (20260219EmergencyFixRecursion.sql)
-- is applied here to the complaints table.
--
-- Root Cause: An RLS policy on complaints queries user_profiles to check role,
-- and user_profiles has a policy that might reference complaints (or vice versa),
-- creating an infinite loop.
--
-- Solution: Use security DEFINER functions to bypass RLS during policy checks.
-- =============================================================================

-- 1. Drop ALL existing policies on complaints to start fresh
DROP POLICY IF EXISTS "Enable read access for all users" ON public.complaints;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.complaints;
DROP POLICY IF EXISTS "Users can view own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Officers can view assigned complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can insert complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can update own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Admins can update all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users can delete own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Coordinators can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "LGU can view all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Service role bypass" ON public.complaints;
DROP POLICY IF EXISTS "complaints_select_own" ON public.complaints;
DROP POLICY IF EXISTS "complaints_select_admin" ON public.complaints;
DROP POLICY IF EXISTS "complaints_insert" ON public.complaints;
DROP POLICY IF EXISTS "complaints_update_own" ON public.complaints;
DROP POLICY IF EXISTS "complaints_update_admin" ON public.complaints;

-- 2. Ensure the safe admin check function exists (from user_profiles fix)
-- This function is security DEFINER so it bypasses RLS when called inside a policy
CREATE OR REPLACE FUNCTION public.check_is_admin_safe()
RETURNS boolean
LANGUAGE sql
security DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin', 'lgu', 'lgu-admin', 'complaint-coordinator')
  );
$$;

-- 3. Create a security DEFINER function to check if user is LGU staff
-- This prevents recursion when checking officer/coordinator roles
CREATE OR REPLACE FUNCTION public.check_is_lgu_staff()
RETURNS boolean
LANGUAGE sql
security DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'admin', 'lgu', 'lgu-admin', 'lgu-officer',
                 'complaint-coordinator', 'lgu-hr')
  );
$$;

-- 4. Ensure RLS is enabled on complaints
ALTER TABLE public.complaints ENABLE ROW LEVEL security;

-- 5. Create non-recursive policies

-- A. Citizens can view their own complaints (Direct ID check, no recursion)
CREATE POLICY "Users can view own complaints" ON public.complaints
FOR SELECT
USING (auth.uid() = submitted_by);

-- B. LGU staff and admins can view ALL complaints (Uses SAFE function)
CREATE POLICY "LGU can view all complaints" ON public.complaints
FOR SELECT
USING (check_is_lgu_staff());

-- C. Authenticated users can insert complaints
CREATE POLICY "Users can insert complaints" ON public.complaints
FOR INSERT
WITH CHECK (auth.uid() = submitted_by);

-- D. Citizens can update their own complaints
CREATE POLICY "Users can update own complaints" ON public.complaints
FOR UPDATE
USING (auth.uid() = submitted_by);

-- E. LGU staff and admins can update any complaint
CREATE POLICY "LGU can update all complaints" ON public.complaints
FOR UPDATE
USING (check_is_lgu_staff());

-- F. Service role always has full access (this is implicit but explicit is safer)
-- Note: Service role key should bypass RLS by default, but adding this as safety net
CREATE POLICY "Service role full access" ON public.complaints
FOR ALL
USING (auth.role() = 'service_role');
