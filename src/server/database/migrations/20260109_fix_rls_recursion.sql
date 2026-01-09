-- FIX: Infinite Recursion in user_profiles Policy
-- This script drops problematic recursive policies and replaces them with safe ones.
-- Run this in your Supabase SQL Editor.

-- 1. Drop existing policies on 'user_profiles' (if it exists) or 'profiles'
-- We try both usually, but let's assume 'user_profiles' is the culprit from the logs.

DO $$
BEGIN
    -- Disable RLS temporarily to break the loop during maintenance
    ALTER TABLE IF EXISTS user_profiles DISABLE ROW LEVEL SECURITY;
    
    -- Drop all policies on user_profiles to clean slate
    DROP POLICY IF EXISTS "Enable read access for all users" ON user_profiles;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_profiles;
    DROP POLICY IF EXISTS "Enable update for users based on email" ON user_profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Everyone can view profiles" ON user_profiles;
    
    -- Re-enable RLS
    ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
END $$;

-- 2. Create NON-RECURSIVE safe policies
-- A policy is recursive if the CHECK/USING condition queries the table itself (e.g. implicitly via a view or helper).
-- We will use simple auth.uid() comparison which is safe.

CREATE POLICY "Safe View Own Profile" ON user_profiles
    FOR SELECT
    USING ( auth.uid() = id ); -- Corrected: id is the references column

-- Allow admins/coordinators to view all (Hardcoded role check to avoid querying profile table for role)
-- NOTE: This relies on JWT metadata, which is safe. 
-- Using 'auth.jwt()->>role' etc.

CREATE POLICY "Safe View All for Admins" ON user_profiles
    FOR SELECT
    USING ( auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'complaint-coordinator') );

-- Same for 'profiles' table if it exists (using a separate block to prevent failure of the first part)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
        
        -- Re-create safe policy
        CREATE POLICY "Profiles are viewable by authenticated users" ON profiles
        FOR SELECT
        USING ( auth.role() = 'authenticated' );
        
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;
