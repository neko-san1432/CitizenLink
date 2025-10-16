-- ============================================================================
-- MISSING TABLES FOR CITIZENLINK APPLICATION
-- Run this script to add tables that are referenced in code but missing from DB_FORMAT.sql
-- ============================================================================

-- ============================================================================
-- ROLE CHANGES AUDIT TABLE
-- ============================================================================
CREATE TABLE public.role_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  old_role text NOT NULL,
  new_role text NOT NULL,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_changes_pkey PRIMARY KEY (id)
);

-- Indexes for role_changes
CREATE INDEX idx_role_changes_user ON public.role_changes(user_id);
CREATE INDEX idx_role_changes_performed_by ON public.role_changes(performed_by);
CREATE INDEX idx_role_changes_created_at ON public.role_changes(created_at DESC);

-- ============================================================================
-- DEPARTMENT TRANSFERS AUDIT TABLE
-- ============================================================================
CREATE TABLE public.department_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  from_department text,
  to_department text NOT NULL,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT department_transfers_pkey PRIMARY KEY (id)
);

-- Indexes for department_transfers
CREATE INDEX idx_dept_transfers_user ON public.department_transfers(user_id);
CREATE INDEX idx_dept_transfers_performed_by ON public.department_transfers(performed_by);
CREATE INDEX idx_dept_transfers_created_at ON public.department_transfers(created_at DESC);

-- ============================================================================
-- COMPLAINT EVIDENCE TABLE
-- ============================================================================
CREATE TABLE public.complaint_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  mime_type text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  uploaded_at timestamp with time zone DEFAULT now(),
  is_public boolean DEFAULT false,
  CONSTRAINT complaint_evidence_pkey PRIMARY KEY (id)
);

-- Indexes for complaint_evidence
CREATE INDEX idx_complaint_evidence_complaint ON public.complaint_evidence(complaint_id);
CREATE INDEX idx_complaint_evidence_uploaded_by ON public.complaint_evidence(uploaded_by);
CREATE INDEX idx_complaint_evidence_uploaded_at ON public.complaint_evidence(uploaded_at DESC);

-- ============================================================================
-- NOTIFICATIONS TABLE (Plural version - if you want to use this instead of singular)
-- ============================================================================
-- Note: You already have 'notification' (singular) table
-- This creates 'notifications' (plural) if you want to switch
-- Comment out if you want to keep using the singular version

/*
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'complaint_submitted', 'assignment', 'status_change', 'deadline', etc.
  priority text DEFAULT 'info' CHECK (priority IN ('info', 'warning', 'urgent')),
  title text NOT NULL,
  message text NOT NULL,
  icon text DEFAULT '📢',
  link text, -- URL to navigate to when clicked
  metadata jsonb DEFAULT '{}', -- Extra data (complaint_id, deadline_hours, etc.)
  read boolean DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '30 days'), -- Auto-expire after 30 days
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_priority ON public.notifications(priority);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_expires ON public.notifications(expires_at);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify tables were created successfully

-- Check if tables exist
SELECT 
  schemaname, 
  tablename, 
  tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('role_changes', 'department_transfers', 'complaint_evidence')
ORDER BY tablename;

-- Check table structures
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('role_changes', 'department_transfers', 'complaint_evidence')
ORDER BY table_name, ordinal_position;

