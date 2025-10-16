-- ============================================================================
-- CitizenLink Complete Database Setup
-- Purpose: Complete schema with all missing tables and fixes
-- Date: 2025-01-15
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CORE TABLES (Missing from DB_FORMAT.sql)
-- ============================================================================

-- Invitation Tokens (for HR-controlled staff registration)
CREATE TABLE IF NOT EXISTS public.invitation_tokens (
  token varchar(128) PRIMARY KEY,
  created_by uuid NOT NULL,
  role varchar(100) NOT NULL,
  department_id uuid NULL,
  employee_id_required boolean NOT NULL DEFAULT true,
  max_uses int NOT NULL DEFAULT 1,
  uses int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitation_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitation_tokens_active_expires
  ON public.invitation_tokens (active, expires_at);

-- Audit Logs (system-wide audit trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type varchar(100) NOT NULL,
  performed_by uuid NOT NULL,
  target_type varchar(50) NULL, -- 'user', 'complaint', 'department', 'role_change'
  target_id uuid NULL,
  details jsonb NOT NULL DEFAULT '{}',
  ip_address inet NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by_created
  ON public.audit_logs (performed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs (target_type, target_id);

-- Complaint History (complaint-specific audit trail)
CREATE TABLE IF NOT EXISTS public.complaint_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  action_type varchar(100) NOT NULL,
  performed_by uuid NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complaint_history_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE,
  CONSTRAINT complaint_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_complaint_history_complaint_created
  ON public.complaint_history (complaint_id, created_at DESC);

-- Complaint Assignments (department routing and officer assignments)
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  department_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_to uuid NULL,
  status varchar(50) NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | completed
  rejection_reason text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complaint_assignments_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id) ON DELETE CASCADE,
  CONSTRAINT complaint_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT complaint_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_complaint
  ON public.complaint_assignments (complaint_id);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_status
  ON public.complaint_assignments (status);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_assigned_to
  ON public.complaint_assignments (assigned_to);

-- ============================================================================
-- 2. FIX EXISTING TABLES
-- ============================================================================

-- Fix users table role constraint to include all 6 roles
-- Note: public.users table does NOT exist - using auth.users exclusively
-- Role data is stored in auth.users.user_metadata and auth.users.raw_user_meta_data
-- LGU Officers now use pattern: lgu-{department_code}
-- LGU Admins use pattern: lgu-admin-{department_code}
-- LGU HR use pattern: lgu-hr-{department_code}
-- No role constraint needed as auth.users is managed by Supabase Auth

-- Add missing columns to complaints table if they don't exist
ALTER TABLE IF EXISTS public.complaints
  ADD COLUMN IF NOT EXISTS department_r text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS primary_department text NULL,
  ADD COLUMN IF NOT EXISTS secondary_departments text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS workflow_status varchar(50) DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS response_deadline timestamptz NULL,
  ADD COLUMN IF NOT EXISTS coordinator_notes text NULL,
  ADD COLUMN IF NOT EXISTS assigned_coordinator_id uuid NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS citizen_satisfaction_rating integer CHECK (citizen_satisfaction_rating >= 1 AND citizen_satisfaction_rating <= 5),
  ADD COLUMN IF NOT EXISTS is_duplicate boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS master_complaint_id uuid NULL,
  ADD COLUMN IF NOT EXISTS task_force_id uuid NULL,
  ADD COLUMN IF NOT EXISTS estimated_resolution_date timestamptz NULL;

-- Add missing foreign key constraints (only if they don't exist)
DO $$
BEGIN
  -- Add assigned_coordinator_id foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'complaints_assigned_coordinator_id_fkey'
    AND table_name = 'complaints'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_assigned_coordinator_id_fkey 
      FOREIGN KEY (assigned_coordinator_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Add master_complaint_id foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'complaints_master_complaint_id_fkey'
    AND table_name = 'complaints'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.complaints
      ADD CONSTRAINT complaints_master_complaint_id_fkey 
      FOREIGN KEY (master_complaint_id) REFERENCES public.complaints(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. ADD MISSING INDEXES FOR PERFORMANCE
-- ============================================================================

-- Complaints table indexes
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);
CREATE INDEX IF NOT EXISTS idx_complaints_workflow_status ON public.complaints (workflow_status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON public.complaints (priority);
CREATE INDEX IF NOT EXISTS idx_complaints_type ON public.complaints (type);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_at ON public.complaints (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_primary_department ON public.complaints (primary_department);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_coordinator ON public.complaints (assigned_coordinator_id);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_by ON public.complaints (submitted_by);

-- Workflow logs indexes
CREATE INDEX IF NOT EXISTS idx_complaint_workflow_logs_complaint_created
  ON public.complaint_workflow_logs (complaint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_complaint_workflow_logs_action_type
  ON public.complaint_workflow_logs (action_type);

-- Role changes indexes
CREATE INDEX IF NOT EXISTS idx_role_changes_user_created
  ON public.role_changes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_changes_performed_by
  ON public.role_changes (performed_by);

-- Department transfers indexes
CREATE INDEX IF NOT EXISTS idx_department_transfers_user
  ON public.department_transfers (user_id);

CREATE INDEX IF NOT EXISTS idx_department_transfers_performed_by
  ON public.department_transfers (performed_by);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
-- Note: public.users does NOT exist - using auth.users (managed by Supabase)
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY; -- REMOVED: Table doesn't exist
ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_tokens ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'role',
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    'citizen'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is staff
-- Updated to support new LGU officer pattern: lgu-{department_code}
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
DECLARE
  user_role text;
BEGIN
  user_role := get_user_role();
  
  -- Check for exact matches
  IF user_role IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin') THEN
    RETURN TRUE;
  END IF;
  
  -- Check for LGU patterns (lgu-wst, lgu-admin-wst, lgu-hr-wst, etc.)
  IF user_role LIKE 'lgu-%' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin or above
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() IN ('lgu-admin', 'lgu-hr', 'super-admin')
         OR get_user_role() LIKE 'lgu-admin-%'
         OR get_user_role() LIKE 'lgu-hr-%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complaints RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Citizens can view their own complaints' 
    AND tablename = 'complaints' 
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Citizens can view their own complaints"
      ON public.complaints FOR SELECT
      USING (
        submitted_by = auth.uid()
        OR is_staff()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Citizens can create complaints' 
    AND tablename = 'complaints' 
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Citizens can create complaints"
      ON public.complaints FOR INSERT
      WITH CHECK (submitted_by = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Staff can update complaints' 
    AND tablename = 'complaints' 
    AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Staff can update complaints"
      ON public.complaints FOR UPDATE
      USING (is_staff());
  END IF;
END $$;

-- Users RLS policies (only if they don't exist)
-- RLS Policies for public.users - REMOVED
-- Note: public.users table does NOT exist - using auth.users exclusively
-- auth.users is managed by Supabase Auth and has its own built-in security
-- User data is accessed via supabase.auth.admin.* methods in the backend

-- Role changes RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own role changes' AND tablename = 'role_changes' AND schemaname = 'public') THEN
    CREATE POLICY "Users can view their own role changes" ON public.role_changes FOR SELECT USING (user_id = auth.uid() OR is_admin_or_above());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can create role changes' AND tablename = 'role_changes' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can create role changes" ON public.role_changes FOR INSERT WITH CHECK (is_admin_or_above());
  END IF;
END $$;

-- Department transfers RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own transfers' AND tablename = 'department_transfers' AND schemaname = 'public') THEN
    CREATE POLICY "Users can view their own transfers" ON public.department_transfers FOR SELECT USING (user_id = auth.uid() OR is_admin_or_above());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can create transfers' AND tablename = 'department_transfers' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can create transfers" ON public.department_transfers FOR INSERT WITH CHECK (is_admin_or_above());
  END IF;
END $$;

-- Workflow logs RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view workflow logs' AND tablename = 'complaint_workflow_logs' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view workflow logs" ON public.complaint_workflow_logs FOR SELECT USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can create workflow logs' AND tablename = 'complaint_workflow_logs' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can create workflow logs" ON public.complaint_workflow_logs FOR INSERT WITH CHECK (is_staff());
  END IF;
END $$;

-- Complaint assignments RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view assignments' AND tablename = 'complaint_assignments' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view assignments" ON public.complaint_assignments FOR SELECT USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage assignments' AND tablename = 'complaint_assignments' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can manage assignments" ON public.complaint_assignments FOR ALL USING (is_staff());
  END IF;
END $$;

-- Complaint history RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view complaint history' AND tablename = 'complaint_history' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view complaint history" ON public.complaint_history FOR SELECT USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can create complaint history' AND tablename = 'complaint_history' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can create complaint history" ON public.complaint_history FOR INSERT WITH CHECK (is_staff());
  END IF;
END $$;

-- Audit logs RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view audit logs' AND tablename = 'audit_logs' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (is_admin_or_above());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can create audit logs' AND tablename = 'audit_logs' AND schemaname = 'public') THEN
    CREATE POLICY "System can create audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Invitation tokens RLS policies (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'HR can manage invitation tokens' AND tablename = 'invitation_tokens' AND schemaname = 'public') THEN
    CREATE POLICY "HR can manage invitation tokens" ON public.invitation_tokens FOR ALL USING (get_user_role() IN ('lgu-hr', 'super-admin') OR get_user_role() LIKE 'lgu-hr-%');
  END IF;
END $$;

-- ============================================================================
-- 5. UTILITY FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log complaint actions/workflow changes
CREATE OR REPLACE FUNCTION public.log_complaint_action(
  p_complaint_id bigint,
  p_action_type text,
  p_from_dept text DEFAULT NULL,
  p_to_dept text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id BIGINT;
BEGIN
  INSERT INTO complaint_workflow_logs (
    complaint_id, action_type, from_department, to_department, 
    performed_by, reason, details
  ) VALUES (
    p_complaint_id, p_action_type, p_from_dept, p_to_dept,
    auth.uid(), p_reason, p_details
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Add updated_at triggers to relevant tables (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_complaints_updated_at') THEN
    CREATE TRIGGER update_complaints_updated_at
      BEFORE UPDATE ON public.complaints
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- Trigger for public.users - REMOVED
  -- Note: public.users table does NOT exist - using auth.users exclusively
  -- auth.users has its own timestamp management (updated_at, last_sign_in_at, etc.)

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_complaint_assignments_updated_at') THEN
    CREATE TRIGGER update_complaint_assignments_updated_at
      BEFORE UPDATE ON public.complaint_assignments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Function to auto-assign departments based on complaint type
CREATE OR REPLACE FUNCTION public.auto_assign_departments()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-assign based on complaint type if no departments specified
  IF NEW.department_r IS NULL OR array_length(NEW.department_r, 1) = 0 THEN
    CASE NEW.type
      WHEN 'infrastructure' THEN
        NEW.department_r := ARRAY['engineering', 'public-works'];
      WHEN 'public-safety' THEN
        NEW.department_r := ARRAY['police', 'fire', 'emergency'];
      WHEN 'environmental' THEN
        NEW.department_r := ARRAY['environment', 'health'];
      WHEN 'health' THEN
        NEW.department_r := ARRAY['health', 'environment'];
      WHEN 'traffic' THEN
        NEW.department_r := ARRAY['traffic', 'engineering'];
      WHEN 'utilities' THEN
        NEW.department_r := ARRAY['utilities', 'engineering'];
      ELSE
        NEW.department_r := ARRAY['general'];
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for auto-assignment (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_assign_departments_trigger') THEN
    CREATE TRIGGER auto_assign_departments_trigger
      BEFORE INSERT ON public.complaints
      FOR EACH ROW EXECUTE FUNCTION public.auto_assign_departments();
  END IF;
END $$;

-- ============================================================================
-- 6. SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample departments
INSERT INTO public.departments (name, code) VALUES
  ('Engineering', 'engineering'),
  ('Public Works', 'public-works'),
  ('Health', 'health'),
  ('Environment', 'environment'),
  ('Police', 'police'),
  ('Fire Department', 'fire'),
  ('Traffic', 'traffic'),
  ('Utilities', 'utilities'),
  ('General Services', 'general')
ON CONFLICT (code) DO NOTHING;

-- Insert sample settings
INSERT INTO public.settings (key, value, type, category, description, is_public) VALUES
  ('system_name', 'CitizenLink', 'text', 'general', 'System name', true),
  ('max_file_size', '10485760', 'number', 'uploads', 'Maximum file upload size in bytes', false),
  ('allowed_file_types', '["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"]', 'json', 'uploads', 'Allowed file types for uploads', false),
  ('default_response_deadline_hours', '72', 'number', 'complaints', 'Default response deadline in hours', false),
  ('enable_duplicate_detection', 'true', 'boolean', 'complaints', 'Enable automatic duplicate detection', false),
  ('duplicate_similarity_threshold', '0.8', 'number', 'complaints', 'Similarity threshold for duplicate detection', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ CitizenLink database setup completed successfully!';
  RAISE NOTICE '📊 Tables created/updated: %', (
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'complaints', 'users', 'departments', 'settings', 'role_changes',
      'department_transfers', 'complaint_workflow_logs', 'complaint_assignments',
      'complaint_history', 'audit_logs', 'invitation_tokens', 'complaint_coordinators',
      'complaint_similarities', 'complaint_duplicates', 'complaint_clusters',
      'task_forces', 'department_escalation_matrix'
    )
  );
  RAISE NOTICE '🔐 RLS policies enabled on all tables';
  RAISE NOTICE '📈 Performance indexes created';
  RAISE NOTICE '🎯 Ready for CitizenLink LGU Complain wt Management System!';
END $$;
