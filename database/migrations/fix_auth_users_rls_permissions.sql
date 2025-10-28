-- Migration: Fix auth.users RLS permissions for service role
-- This migration adds RLS policies to allow the service role to access auth.users table
-- which is required for foreign key constraint validation during complaint submission

-- Enable RLS on auth.users table (if not already enabled)
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access to auth.users
CREATE POLICY "Allow service role full access to auth.users" ON auth.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Also create policy for authenticated users to access their own data
CREATE POLICY "Allow users to access their own data" ON auth.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Grant necessary permissions to service_role
GRANT ALL ON auth.users TO service_role;
GRANT USAGE ON SCHEMA auth TO service_role;
