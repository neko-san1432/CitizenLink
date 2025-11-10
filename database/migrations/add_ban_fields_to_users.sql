-- Migration Script: Add isBanned and warningStrike fields to all users
-- 
-- This SQL script adds the following fields to each user's metadata:
-- - isBanned (default: false)
-- - warningStrike (default: 0)
-- 
-- Run this script in Supabase SQL Editor or your PostgreSQL client
-- to initialize ban fields for all existing users.
-- 
-- IMPORTANT: This script only updates users that don't already have these fields.
-- It won't overwrite existing values.

-- Update raw_user_meta_data for all users that don't have isBanned field
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  jsonb_build_object(
    'isBanned', COALESCE(raw_user_meta_data->>'isBanned', 'false')::boolean,
    'warningStrike', COALESCE((raw_user_meta_data->>'warningStrike')::int, 0)
  )
WHERE raw_user_meta_data->>'isBanned' IS NULL 
   OR raw_user_meta_data->>'warningStrike' IS NULL;

-- Update user_metadata for all users that don't have isBanned field
UPDATE auth.users
SET user_metadata = COALESCE(user_metadata, '{}'::jsonb) || 
  jsonb_build_object(
    'isBanned', COALESCE(user_metadata->>'isBanned', 'false')::boolean,
    'warningStrike', COALESCE((user_metadata->>'warningStrike')::int, 0)
  )
WHERE user_metadata->>'isBanned' IS NULL 
   OR user_metadata->>'warningStrike' IS NULL;

-- Verify the update (optional - run this to check results)
-- SELECT 
--   id,
--   email,
--   raw_user_meta_data->>'isBanned' as is_banned,
--   raw_user_meta_data->>'warningStrike' as warning_strike
-- FROM auth.users
-- LIMIT 10;

