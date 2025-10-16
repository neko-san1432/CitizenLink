-- ============================================================================
-- Create Application Notifications Table
-- This is separate from the existing 'notification' table which is for news/notices
-- ============================================================================

-- Drop existing app_notifications table if exists
DROP TABLE IF EXISTS public.app_notifications CASCADE;

-- Create app_notifications table for in-app user notifications
CREATE TABLE public.app_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  priority text NOT NULL DEFAULT 'info' CHECK (priority IN ('info', 'warning', 'urgent')),
  title text NOT NULL,
  message text NOT NULL,
  icon text DEFAULT '📢',
  link text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  read_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT app_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT app_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_app_notifications_user_id ON public.app_notifications(user_id);
CREATE INDEX idx_app_notifications_user_read ON public.app_notifications(user_id, read);
CREATE INDEX idx_app_notifications_created_at ON public.app_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.app_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.app_notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- System can insert notifications for any user (service role)
CREATE POLICY "Service role can insert notifications"
  ON public.app_notifications
  FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT, UPDATE ON public.app_notifications TO authenticated;
GRANT INSERT ON public.app_notifications TO service_role;

-- Comment
COMMENT ON TABLE public.app_notifications IS 'Application notifications for users (assignments, status changes, etc.)';


