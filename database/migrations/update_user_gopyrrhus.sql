-- Update user metadata for gopyrrhus@g.cjc.edu.ph
-- Add missing fields to match the expected schema
-- This merges with existing metadata, preserving what's already there

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  -- Keep existing identity fields, set defaults if missing
  'name', COALESCE(raw_user_meta_data->>'name', 'Pyrrhus Go'),
  'first_name', COALESCE(raw_user_meta_data->>'first_name', 'Pyrrhus'),
  'last_name', COALESCE(raw_user_meta_data->>'last_name', 'Go'),
  'role', COALESCE(raw_user_meta_data->>'role', 'citizen'),
  'normalized_role', COALESCE(raw_user_meta_data->>'normalized_role', 'citizen'),
  'mobile_number', COALESCE(raw_user_meta_data->>'mobile_number', '09171234567'),
  'mobile', COALESCE(raw_user_meta_data->>'mobile', raw_user_meta_data->>'mobile_number', '09171234567'),
  
  -- Status and verification (set based on email_confirmed_at)
  'status', CASE 
    WHEN raw_user_meta_data->>'status' IS NOT NULL THEN raw_user_meta_data->>'status'
    WHEN email_confirmed_at IS NOT NULL THEN 'active'
    ELSE 'pending_verification'
  END,
  'email_verified', CASE 
    WHEN raw_user_meta_data->>'email_verified' IS NOT NULL THEN (raw_user_meta_data->>'email_verified')::boolean
    WHEN email_confirmed_at IS NOT NULL THEN true
    ELSE false
  END,
  'mobile_verified', COALESCE((raw_user_meta_data->>'mobile_verified')::boolean, false),
  'phone_verified', COALESCE((raw_user_meta_data->>'phone_verified')::boolean, false),
  
  -- OAuth
  'is_oauth', COALESCE((raw_user_meta_data->>'is_oauth')::boolean, false),
  
  -- Preferences (set defaults if missing)
  'preferred_language', COALESCE(raw_user_meta_data->>'preferred_language', 'en'),
  'timezone', COALESCE(raw_user_meta_data->>'timezone', 'Asia/Manila'),
  'email_notifications', COALESCE((raw_user_meta_data->>'email_notifications')::boolean, true),
  'sms_notifications', COALESCE((raw_user_meta_data->>'sms_notifications')::boolean, false),
  'push_notifications', COALESCE((raw_user_meta_data->>'push_notifications')::boolean, true),
  
  -- Banning system (initialize if missing)
  'banStrike', COALESCE((raw_user_meta_data->>'banStrike')::integer, 0),
  'banStarted', NULLIF(raw_user_meta_data->>'banStarted', ''),
  'banDuration', NULLIF(raw_user_meta_data->>'banDuration', ''),
  'permanentBan', COALESCE((raw_user_meta_data->>'permanentBan')::boolean, false),
  
  -- Timestamps
  'updated_at', NOW()::text
)
WHERE email = 'gopyrrhus@g.cjc.edu.ph';

-- Verify the update
SELECT 
  email,
  raw_user_meta_data,
  email_confirmed_at,
  confirmed_at
FROM auth.users
WHERE email = 'gopyrrhus@g.cjc.edu.ph';

