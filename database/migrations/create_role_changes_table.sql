-- Migration: Create role_changes table
-- This table tracks role changes for audit purposes

-- Create role_changes table
CREATE TABLE IF NOT EXISTS public.role_changes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    old_role text,
    new_role text NOT NULL,
    changed_by uuid NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

-- Add foreign key constraints
ALTER TABLE public.role_changes 
    ADD CONSTRAINT fk_role_changes_user_id 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.role_changes 
    ADD CONSTRAINT fk_role_changes_changed_by 
    FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_role_changes_user_id ON public.role_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_role_changes_changed_by ON public.role_changes(changed_by);
CREATE INDEX IF NOT EXISTS idx_role_changes_created_at ON public.role_changes(created_at);
CREATE INDEX IF NOT EXISTS idx_role_changes_new_role ON public.role_changes(new_role);

-- Add RLS policies
ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own role changes
CREATE POLICY "Users can view own role changes" ON public.role_changes
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Admins can view all role changes
CREATE POLICY "Admins can view all role changes" ON public.role_changes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE id = auth.uid() 
            AND (raw_user_meta_data->>'role' IN ('super-admin', 'lgu-admin', 'lgu-hr'))
        )
    );

-- Add comments for documentation
COMMENT ON TABLE public.role_changes IS 'Audit log for role changes';
COMMENT ON COLUMN public.role_changes.user_id IS 'User whose role was changed';
COMMENT ON COLUMN public.role_changes.old_role IS 'Previous role';
COMMENT ON COLUMN public.role_changes.new_role IS 'New role';
COMMENT ON COLUMN public.role_changes.changed_by IS 'Admin who made the change';
COMMENT ON COLUMN public.role_changes.reason IS 'Reason for the role change';
COMMENT ON COLUMN public.role_changes.metadata IS 'Additional metadata about the change';