-- ============================================================================
-- RPC Function: Get Department Admin IDs
-- Returns user IDs of admins for a specific department
-- ============================================================================

-- Drop existing function if it exists (in case return type changed)
DROP FUNCTION IF EXISTS public.get_department_admin_ids(text);

CREATE OR REPLACE FUNCTION public.get_department_admin_ids(p_department_code text)
RETURNS TABLE(user_id uuid, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get all users with lgu-admin-{department_code} role
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'name', u.email) as name
  FROM auth.users u
  WHERE u.raw_user_meta_data->>'role' = 'lgu-admin-' || p_department_code
     OR u.user_metadata->>'role' = 'lgu-admin-' || p_department_code
  ORDER BY u.created_at;
END;
$$;
