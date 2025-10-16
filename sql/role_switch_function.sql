-- ============================================================================
-- Role Switch Function
-- Updates auth.users.raw_user_meta_data directly via SQL
-- ============================================================================

-- Create function to switch user role
CREATE OR REPLACE FUNCTION public.switch_user_role(
  p_user_id uuid,
  p_target_role text,
  p_normalized_role text,
  p_actual_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_updated_metadata jsonb;
  v_metadata_update jsonb;
BEGIN
  -- Build metadata update object
  v_metadata_update := jsonb_build_object(
    'role', p_target_role,
    'normalized_role', p_normalized_role,
    'updated_at', NOW()
  );
  
  -- Only add actual_role if it's not null and not 'citizen'
  IF p_actual_role IS NOT NULL AND p_actual_role != 'citizen' THEN
    v_metadata_update := v_metadata_update || jsonb_build_object('actual_role', p_actual_role);
  END IF;
  
  -- Update auth.users with new role (only raw_user_meta_data is our single source of truth)
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || v_metadata_update,
  updated_at = NOW()
  WHERE id = p_user_id
  RETURNING raw_user_meta_data INTO v_updated_metadata;

  -- Return the updated metadata
  RETURN v_updated_metadata;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.switch_user_role(uuid, text, text, text) TO authenticated;

-- Comment
COMMENT ON FUNCTION public.switch_user_role IS 'Switches user role by directly updating auth.users.raw_user_meta_data';

