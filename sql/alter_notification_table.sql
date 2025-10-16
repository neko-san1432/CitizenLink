-- ============================================================================
-- Alter Existing Notification Table
-- Add columns needed for application notifications
-- ============================================================================

-- Add new columns to existing notification table
ALTER TABLE public.notification 
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'info' CHECK (priority IN ('info', 'warning', 'urgent')),
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS icon text DEFAULT '📢',
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Add foreign key constraint for user_id
ALTER TABLE public.notification
  ADD CONSTRAINT notification_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_user_id ON public.notification(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_user_read ON public.notification(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notification_created_at ON public.notification(created_at DESC);

-- Update RLS if not already enabled
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notification;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notification;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notification;

-- Create RLS Policies
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notification
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = owner);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notification
  FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = owner);

-- System can insert notifications for any user (service role)
CREATE POLICY "Service role can insert notifications"
  ON public.notification
  FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, UPDATE ON public.notification TO authenticated;
GRANT INSERT ON public.notification TO service_role;

-- Comment
COMMENT ON TABLE public.notification IS 'Application notifications for users (assignments, status changes, news, notices)';


