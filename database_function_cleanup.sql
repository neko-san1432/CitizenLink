-- ============================================================================
-- CitizenLink Database Function Cleanup
-- Purpose: Remove duplicate and redundant functions
-- Date: 2025-01-15
-- ============================================================================

-- ============================================================================
-- 1. REMOVE DUPLICATE FUNCTIONS
-- ============================================================================

-- Remove the redundant auto_assign_departments function (keep the trigger version)
-- The trigger version automatically handles assignment on INSERT
DROP FUNCTION IF EXISTS public.auto_assign_departments(bigint);

-- Remove the redundant log_complaint_action function (keep the one that returns log_id)
-- The void version is redundant since we want to track log IDs
DROP FUNCTION IF EXISTS public.log_complaint_action(
  bigint, text, uuid, text, text, text, text, text, text, jsonb
);

-- ============================================================================
-- 2. RENAME CONFLICTING FUNCTIONS FOR CLARITY
-- ============================================================================

-- Rename the remaining log_complaint_action to be more specific
ALTER FUNCTION public.log_complaint_action(
  bigint, text, text, text, text, jsonb
) RENAME TO log_complaint_workflow_action;

-- ============================================================================
-- 3. CREATE MISSING HELPER FUNCTIONS
-- ============================================================================

-- Function to get user display name (if not exists)
CREATE OR REPLACE FUNCTION public.get_user_display_name(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  display_name TEXT;
BEGIN
  -- Check if users table exists
  -- Note: public.users does NOT exist - using auth.users exclusively
  SELECT 
    COALESCE(
      raw_user_meta_data->>'name',
      raw_user_meta_data->>'full_name',
      user_metadata->>'name',
      user_metadata->>'full_name',
      email
    ) INTO display_name
  FROM auth.users 
  WHERE id = p_user_id;
  
  RETURN COALESCE(display_name, 'Unknown User');
END;
$$;

-- Function to update user metadata (if not exists)
CREATE OR REPLACE FUNCTION public.update_user_meta_data(
  user_id uuid, 
  meta_key text, 
  meta_value jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users 
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(meta_key, meta_value)
  WHERE id = user_id;
  
  RETURN FOUND;
END;
$$;

-- Function to update user login tracking (if not exists)
CREATE OR REPLACE FUNCTION public.update_user_login(
  p_user_id uuid, 
  p_ip_address text DEFAULT NULL, 
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if users table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    UPDATE users 
    SET 
      last_login_at = NOW(),
      login_count = login_count + 1
    WHERE id = p_user_id;
  END IF;
  
  -- Insert session record (if user_sessions table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions' AND table_schema = 'public') THEN
    INSERT INTO user_sessions (user_id, ip_address, user_agent)
    VALUES (p_user_id, p_ip_address::INET, p_user_agent);
  END IF;
END;
$$;

-- ============================================================================
-- 4. CREATE MISSING TRIGGER FUNCTIONS
-- ============================================================================

-- Function to track role changes (if not exists)
CREATE OR REPLACE FUNCTION public.track_role_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only track if user_role_history table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_role_history' AND table_schema = 'public') THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO user_role_history (user_id, old_role, new_role, changed_by)
      VALUES (NEW.id, OLD.role, NEW.role, NEW.updated_by);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. ADD MISSING TRIGGERS
-- ============================================================================

-- Add trigger for role change tracking (only if users table exists and trigger doesn't exist)
DO $$
BEGIN
  -- Note: public.users does NOT exist - using auth.users exclusively
  -- Role changes are tracked via backend services when updating auth.users metadata
  RAISE NOTICE 'public.users table does NOT exist - role changes tracked via backend services';
END $$;

-- ============================================================================
-- 6. CREATE USEFUL UTILITY FUNCTIONS
-- ============================================================================

-- Function to check if user is banned
CREATE OR REPLACE FUNCTION public.is_user_banned()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT (raw_user_meta_data->>'permanentBan')::boolean FROM auth.users WHERE id = auth.uid()),
    false
  );
END;
$$;

-- Function to get user department
CREATE OR REPLACE FUNCTION public.get_user_department()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT raw_user_meta_data->>'department' FROM auth.users WHERE id = auth.uid());
END;
$$;

-- ============================================================================
-- 7. CREATE COMPLAINT UTILITY FUNCTIONS
-- ============================================================================

-- Function to check potential duplicates (simplified version)
CREATE OR REPLACE FUNCTION public.check_potential_duplicates(p_complaint_id uuid)
RETURNS TABLE(potential_duplicate_id uuid, similarity_score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  complaint_record RECORD;
BEGIN
  -- Get the complaint we're checking
  SELECT * INTO complaint_record FROM complaints WHERE id = p_complaint_id;
  
  -- Find potential duplicates based on location (within 100 meters) and similar time
  RETURN QUERY
  SELECT 
    c.id,
    0.8::DECIMAL as similarity_score  -- Simple score for location-based detection
  FROM complaints c
  WHERE c.id != p_complaint_id
  AND c.submitted_at > (complaint_record.submitted_at - INTERVAL '7 days')
  AND c.latitude IS NOT NULL 
  AND c.longitude IS NOT NULL
  AND complaint_record.latitude IS NOT NULL 
  AND complaint_record.longitude IS NOT NULL
  AND (
    -- Calculate distance using Haversine formula approximation
    6371000 * acos(
      cos(radians(complaint_record.latitude)) * 
      cos(radians(c.latitude)) * 
      cos(radians(c.longitude) - radians(complaint_record.longitude)) + 
      sin(radians(complaint_record.latitude)) * 
      sin(radians(c.latitude))
    ) < 100  -- Within 100 meters
  )
  AND c.type = complaint_record.type
  LIMIT 5;
END;
$$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Function cleanup completed successfully!';
  RAISE NOTICE '🗑️ Removed duplicate functions';
  RAISE NOTICE '🔄 Renamed conflicting functions';
  RAISE NOTICE '➕ Added missing utility functions';
  RAISE NOTICE '🎯 Database functions are now clean and organized!';
END $$;
