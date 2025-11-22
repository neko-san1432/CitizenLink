-- Migration: Create RPC to query users by role efficiently
-- Created at: 2025-11-23

-- Function to get users by role and optional department
-- Returns simplified user objects to avoid sending too much data
CREATE OR REPLACE FUNCTION get_users_by_role(
  p_role TEXT,
  p_department TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  email VARCHAR,
  raw_user_meta_data JSONB
)
SECURITY DEFINER -- Runs with privileges of the creator (service role)
SET search_path = public, auth -- Set search path to include auth schema
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email::VARCHAR,
    au.raw_user_meta_data
  FROM auth.users au
  WHERE 
    -- Check role in metadata (handle both 'role' and 'base_role')
    (
      au.raw_user_meta_data->>'role' = p_role 
      OR 
      au.raw_user_meta_data->>'base_role' = p_role
    )
    AND
    -- Optional department filter
    (
      p_department IS NULL 
      OR 
      au.raw_user_meta_data->>'department' = p_department
      OR
      au.raw_user_meta_data->>'dpt' = p_department
    );
END;
$$ LANGUAGE plpgsql;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_users_by_role(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_by_role(TEXT, TEXT) TO service_role;
