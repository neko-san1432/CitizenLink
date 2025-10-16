-- =============================================================================
-- Secure RPCs for Admin Lookups
-- Date: 2025-10-08
-- Purpose: Provide SECURITY DEFINER functions to query auth.users for admin IDs
-- =============================================================================

-- Ensure required extensions exist (usually already enabled in project)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function: get_department_admin_ids
-- Returns array of user UUIDs for admins of a department (and global admins)
-- Rules:
--  - Matches roles: 'lgu-admin' and 'lgu-admin-<dept_code>'
--  - Reads from auth.users securely via SECURITY DEFINER
--  - No input is interpolated into SQL; uses query parameters
--  - Stable and safe for RLS environments
CREATE OR REPLACE FUNCTION public.get_department_admin_ids(p_department_code text)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Guard: null/empty inputs return empty array
  IF p_department_code IS NULL OR btrim(p_department_code) = '' THEN
    RETURN v_ids;
  END IF;

  -- Collect admins: exact 'lgu-admin' (global) or 'lgu-admin-<code>'
  SELECT coalesce(array_agg(u.id), ARRAY[]::uuid[])
    INTO v_ids
  FROM auth.users u
  WHERE (u.raw_user_meta_data->> 'role') ILIKE 'lgu-admin'
     OR (u.raw_user_meta_data->> 'role') ILIKE ('lgu-admin-' || lower(p_department_code));

  RETURN v_ids;
END;
$$;

-- Optional: Restrict execution to authenticated users (adjust as needed)
-- REVOKE ALL ON FUNCTION public.get_department_admin_ids(text) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.get_department_admin_ids(text) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE '✅ Created function public.get_department_admin_ids(text)';
END $$;






