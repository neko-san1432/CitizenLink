-- ============================================================================
-- Fix signup_links table - handle existing policies
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "HR can manage signup links" ON public.signup_links;
DROP POLICY IF EXISTS "Public can view active signup links" ON public.signup_links;

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.signup_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    department_code VARCHAR(20),
    created_by UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_signup_links_code ON public.signup_links(code);
CREATE INDEX IF NOT EXISTS idx_signup_links_role ON public.signup_links(role);
CREATE INDEX IF NOT EXISTS idx_signup_links_department ON public.signup_links(department_code);
CREATE INDEX IF NOT EXISTS idx_signup_links_created_by ON public.signup_links(created_by);
CREATE INDEX IF NOT EXISTS idx_signup_links_active ON public.signup_links(is_active);
CREATE INDEX IF NOT EXISTS idx_signup_links_expires ON public.signup_links(expires_at);

-- Enable RLS if not already enabled
ALTER TABLE public.signup_links ENABLE ROW LEVEL SECURITY;

-- Create policies with unique names
CREATE POLICY "hr_manage_signup_links" ON public.signup_links
    FOR ALL USING (
        created_by = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (
                (raw_user_meta_data->>'role')::text LIKE 'lgu-hr%' OR
                (raw_user_meta_data->>'role')::text = 'super-admin'
            )
        )
    );

CREATE POLICY "public_view_active_signup_links" ON public.signup_links
    FOR SELECT USING (
        is_active = true AND 
        (expires_at IS NULL OR expires_at > NOW())
    );

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.update_signup_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS update_signup_links_updated_at ON public.signup_links;
CREATE TRIGGER update_signup_links_updated_at
    BEFORE UPDATE ON public.signup_links
    FOR EACH ROW
    EXECUTE FUNCTION public.update_signup_links_updated_at();

-- Display confirmation
DO $$ 
BEGIN
    RAISE NOTICE '✅ Fixed signup_links table with RLS policies and indexes';
END $$;



