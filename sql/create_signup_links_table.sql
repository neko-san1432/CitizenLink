-- ============================================================================
-- Create signup_links table for HR link generation
-- ============================================================================

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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_signup_links_code ON public.signup_links(code);
CREATE INDEX IF NOT EXISTS idx_signup_links_role ON public.signup_links(role);
CREATE INDEX IF NOT EXISTS idx_signup_links_department ON public.signup_links(department_code);
CREATE INDEX IF NOT EXISTS idx_signup_links_created_by ON public.signup_links(created_by);
CREATE INDEX IF NOT EXISTS idx_signup_links_active ON public.signup_links(is_active);
CREATE INDEX IF NOT EXISTS idx_signup_links_expires ON public.signup_links(expires_at);

-- Add RLS policies
ALTER TABLE public.signup_links ENABLE ROW LEVEL SECURITY;

-- Policy for HR users to manage their own links
CREATE POLICY "HR can manage signup links" ON public.signup_links
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

-- Policy for public access to active, non-expired links
CREATE POLICY "Public can view active signup links" ON public.signup_links
    FOR SELECT USING (
        is_active = true AND 
        (expires_at IS NULL OR expires_at > NOW())
    );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_signup_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_signup_links_updated_at
    BEFORE UPDATE ON public.signup_links
    FOR EACH ROW
    EXECUTE FUNCTION public.update_signup_links_updated_at();

-- Display confirmation
DO $$ 
BEGIN
    RAISE NOTICE '✅ Created signup_links table with RLS policies and indexes';
END $$;



