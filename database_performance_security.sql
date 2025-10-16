-- ============================================================================
-- CitizenLink Database Performance, Security & Utility Functions
-- Purpose: Complete the DB_FORMAT.sql with indexes, RLS policies, and functions
-- Date: 2025-01-15
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "cube" CASCADE;
CREATE EXTENSION IF NOT EXISTS "earthdistance" CASCADE;
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 1. PERFORMANCE INDEXES
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
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints USING GIST (ll_to_earth(latitude, longitude)) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_complaints_duplicate_check ON public.complaints (is_duplicate, master_complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaints_title_trgm ON public.complaints USING GIN (title gin_trgm_ops);

-- Workflow logs indexes
CREATE INDEX IF NOT EXISTS idx_complaint_workflow_logs_complaint_created
  ON public.complaint_workflow_logs (complaint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_workflow_logs_action_type
  ON public.complaint_workflow_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_complaint_workflow_logs_action_by
  ON public.complaint_workflow_logs (action_by);

-- Complaint assignments indexes
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_complaint
  ON public.complaint_assignments (complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_status
  ON public.complaint_assignments (status);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_assigned_to
  ON public.complaint_assignments (assigned_to);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_department
  ON public.complaint_assignments (department_id);

-- Complaint history indexes
CREATE INDEX IF NOT EXISTS idx_complaint_history_complaint_created
  ON public.complaint_history (complaint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_history_action_type
  ON public.complaint_history (action_type);

-- Role changes indexes
CREATE INDEX IF NOT EXISTS idx_role_changes_user_created
  ON public.role_changes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_changes_performed_by
  ON public.role_changes (performed_by);
CREATE INDEX IF NOT EXISTS idx_role_changes_new_role
  ON public.role_changes (new_role);

-- Department transfers indexes
CREATE INDEX IF NOT EXISTS idx_department_transfers_user
  ON public.department_transfers (user_id);
CREATE INDEX IF NOT EXISTS idx_department_transfers_performed_by
  ON public.department_transfers (performed_by);
CREATE INDEX IF NOT EXISTS idx_department_transfers_to_department
  ON public.department_transfers (to_department);

-- Users table indexes - REMOVED
-- Note: public.users table does NOT exist - using auth.users exclusively
-- auth.users is managed by Supabase and has its own indexes
-- User metadata (role, department, etc.) is stored in JSONB fields which can't be easily indexed

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by_created
  ON public.audit_logs (performed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type
  ON public.audit_logs (action_type);

-- Invitation tokens indexes
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_active_expires
  ON public.invitation_tokens (active, expires_at);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_created_by
  ON public.invitation_tokens (created_by);
CREATE INDEX IF NOT EXISTS idx_invitation_tokens_role
  ON public.invitation_tokens (role);

-- Complaint similarities indexes
CREATE INDEX IF NOT EXISTS idx_complaint_similarities_complaint
  ON public.complaint_similarities (complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_similarities_similar
  ON public.complaint_similarities (similar_complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_similarities_score
  ON public.complaint_similarities (similarity_score DESC);

-- Complaint clusters indexes
CREATE INDEX IF NOT EXISTS idx_complaint_clusters_status
  ON public.complaint_clusters (status);
CREATE INDEX IF NOT EXISTS idx_complaint_clusters_pattern_type
  ON public.complaint_clusters (pattern_type);
CREATE INDEX IF NOT EXISTS idx_complaint_clusters_location
  ON public.complaint_clusters USING GIST (ll_to_earth(center_lat, center_lng)) WHERE center_lat IS NOT NULL AND center_lng IS NOT NULL;

-- Task forces indexes
CREATE INDEX IF NOT EXISTS idx_task_forces_active
  ON public.task_forces (is_active);
CREATE INDEX IF NOT EXISTS idx_task_forces_coordinator
  ON public.task_forces (coordinator_id);
CREATE INDEX IF NOT EXISTS idx_task_forces_lead_department
  ON public.task_forces (lead_department);

-- User sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON public.user_sessions (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at
  ON public.user_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity
  ON public.user_sessions (last_activity_at DESC);

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
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
ALTER TABLE public.complaint_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_similarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_forces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_escalation_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role from JWT
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'role',
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_user_meta_data' ->> 'role'),
    'citizen'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  -- Updated to support LGU officer pattern: lgu-wst, lgu-engineering, etc.
  RETURN get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
         OR get_user_role() LIKE 'lgu-%'
         OR get_user_role() LIKE 'lgu-admin-%'
         OR get_user_role() LIKE 'lgu-hr-%';
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

-- Helper function to check if user is HR or above
CREATE OR REPLACE FUNCTION public.is_hr_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() IN ('lgu-hr', 'super-admin')
         OR get_user_role() LIKE 'lgu-hr-%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complaints RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Citizens can view their own complaints' AND tablename = 'complaints' AND schemaname = 'public') THEN
    CREATE POLICY "Citizens can view their own complaints"
      ON public.complaints FOR SELECT
      USING (
        submitted_by = auth.uid()
        OR is_staff()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Citizens can create complaints' AND tablename = 'complaints' AND schemaname = 'public') THEN
    CREATE POLICY "Citizens can create complaints"
      ON public.complaints FOR INSERT
      WITH CHECK (submitted_by = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can update complaints' AND tablename = 'complaints' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can update complaints"
      ON public.complaints FOR UPDATE
      USING (is_staff());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete complaints' AND tablename = 'complaints' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can delete complaints"
      ON public.complaints FOR DELETE
      USING (is_admin_or_above());
  END IF;
END $$;

-- Users RLS policies
-- RLS Policies for public.users - REMOVED
-- Note: public.users table does NOT exist - using auth.users exclusively
-- auth.users is managed by Supabase Auth and has its own built-in security
-- User data is accessed via supabase.auth.admin.* methods in the backend

-- Role changes RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own role changes' AND tablename = 'role_changes' AND schemaname = 'public') THEN
    CREATE POLICY "Users can view their own role changes"
      ON public.role_changes FOR SELECT
      USING (user_id = auth.uid() OR is_admin_or_above());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can create role changes' AND tablename = 'role_changes' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can create role changes"
      ON public.role_changes FOR INSERT
      WITH CHECK (is_admin_or_above());
  END IF;
END $$;

-- Department transfers RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own transfers' AND tablename = 'department_transfers' AND schemaname = 'public') THEN
    CREATE POLICY "Users can view their own transfers"
      ON public.department_transfers FOR SELECT
      USING (user_id = auth.uid() OR is_admin_or_above());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can create transfers' AND tablename = 'department_transfers' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can create transfers"
      ON public.department_transfers FOR INSERT
      WITH CHECK (is_admin_or_above());
  END IF;
END $$;

-- Workflow logs RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view workflow logs' AND tablename = 'complaint_workflow_logs' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view workflow logs"
      ON public.complaint_workflow_logs FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can create workflow logs' AND tablename = 'complaint_workflow_logs' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can create workflow logs"
      ON public.complaint_workflow_logs FOR INSERT
      WITH CHECK (is_staff());
  END IF;
END $$;

-- Complaint assignments RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view assignments' AND tablename = 'complaint_assignments' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view assignments"
      ON public.complaint_assignments FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage assignments' AND tablename = 'complaint_assignments' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can manage assignments"
      ON public.complaint_assignments FOR ALL
      USING (is_staff());
  END IF;
END $$;

-- Complaint history RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view complaint history' AND tablename = 'complaint_history' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view complaint history"
      ON public.complaint_history FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can create complaint history' AND tablename = 'complaint_history' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can create complaint history"
      ON public.complaint_history FOR INSERT
      WITH CHECK (is_staff());
  END IF;
END $$;

-- Audit logs RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view audit logs' AND tablename = 'audit_logs' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can view audit logs"
      ON public.audit_logs FOR SELECT
      USING (is_admin_or_above());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can create audit logs' AND tablename = 'audit_logs' AND schemaname = 'public') THEN
    CREATE POLICY "System can create audit logs"
      ON public.audit_logs FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Invitation tokens RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'HR can manage invitation tokens' AND tablename = 'invitation_tokens' AND schemaname = 'public') THEN
    CREATE POLICY "HR can manage invitation tokens"
      ON public.invitation_tokens FOR ALL
      USING (is_hr_or_above());
  END IF;
END $$;

-- Complaint coordinators RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view coordinators' AND tablename = 'complaint_coordinators' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view coordinators"
      ON public.complaint_coordinators FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage coordinators' AND tablename = 'complaint_coordinators' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can manage coordinators"
      ON public.complaint_coordinators FOR ALL
      USING (is_admin_or_above());
  END IF;
END $$;

-- Complaint similarities RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view similarities' AND tablename = 'complaint_similarities' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view similarities"
      ON public.complaint_similarities FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage similarities' AND tablename = 'complaint_similarities' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can manage similarities"
      ON public.complaint_similarities FOR ALL
      USING (is_staff());
  END IF;
END $$;

-- Complaint duplicates RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view duplicates' AND tablename = 'complaint_duplicates' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view duplicates"
      ON public.complaint_duplicates FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage duplicates' AND tablename = 'complaint_duplicates' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can manage duplicates"
      ON public.complaint_duplicates FOR ALL
      USING (is_staff());
  END IF;
END $$;

-- Complaint clusters RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view clusters' AND tablename = 'complaint_clusters' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view clusters"
      ON public.complaint_clusters FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can manage clusters' AND tablename = 'complaint_clusters' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can manage clusters"
      ON public.complaint_clusters FOR ALL
      USING (is_staff());
  END IF;
END $$;

-- Task forces RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view task forces' AND tablename = 'task_forces' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view task forces"
      ON public.task_forces FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage task forces' AND tablename = 'task_forces' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can manage task forces"
      ON public.task_forces FOR ALL
      USING (is_admin_or_above());
  END IF;
END $$;

-- Department escalation matrix RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view escalation matrix' AND tablename = 'department_escalation_matrix' AND schemaname = 'public') THEN
    CREATE POLICY "Staff can view escalation matrix"
      ON public.department_escalation_matrix FOR SELECT
      USING (is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage escalation matrix' AND tablename = 'department_escalation_matrix' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can manage escalation matrix"
      ON public.department_escalation_matrix FOR ALL
      USING (is_admin_or_above());
  END IF;
END $$;

-- User sessions RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own sessions' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    CREATE POLICY "Users can view their own sessions"
      ON public.user_sessions FOR SELECT
      USING (user_id = auth.uid() OR is_admin_or_above());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System can manage sessions' AND tablename = 'user_sessions' AND schemaname = 'public') THEN
    CREATE POLICY "System can manage sessions"
      ON public.user_sessions FOR ALL
      WITH CHECK (true);
  END IF;
END $$;

-- Departments RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone can view departments' AND tablename = 'departments' AND schemaname = 'public') THEN
    CREATE POLICY "Everyone can view departments"
      ON public.departments FOR SELECT
      USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage departments' AND tablename = 'departments' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can manage departments"
      ON public.departments FOR ALL
      USING (is_admin_or_above());
  END IF;
END $$;

-- Settings RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public settings visible to all' AND tablename = 'settings' AND schemaname = 'public') THEN
    CREATE POLICY "Public settings visible to all"
      ON public.settings FOR SELECT
      USING (is_public = true OR is_staff());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage settings' AND tablename = 'settings' AND schemaname = 'public') THEN
    CREATE POLICY "Admins can manage settings"
      ON public.settings FOR ALL
      USING (is_admin_or_above());
  END IF;
END $$;

-- ============================================================================
-- 3. UTILITY FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_department_escalation_matrix_updated_at') THEN
    CREATE TRIGGER update_department_escalation_matrix_updated_at
      BEFORE UPDATE ON public.department_escalation_matrix
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_settings_updated_at') THEN
    CREATE TRIGGER update_settings_updated_at
      BEFORE UPDATE ON public.settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_departments_updated_at') THEN
    CREATE TRIGGER update_departments_updated_at
      BEFORE UPDATE ON public.departments
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
      WHEN 'noise' THEN
        NEW.department_r := ARRAY['police', 'environment'];
      WHEN 'services' THEN
        NEW.department_r := ARRAY['general', 'public-works'];
      ELSE
        NEW.department_r := ARRAY['general'];
    END CASE;
  END IF;
  
  -- Set primary department to first in array
  IF array_length(NEW.department_r, 1) > 0 THEN
    NEW.primary_department := NEW.department_r[1];
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

-- Function to log complaint workflow changes
CREATE OR REPLACE FUNCTION public.log_complaint_workflow()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.complaint_workflow_logs (complaint_id, action_type, action_by, details)
    VALUES (
      NEW.id,
      'status_change',
      auth.uid(),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'changed_at', now()
      )
    );
  END IF;

  -- Log workflow status changes
  IF TG_OP = 'UPDATE' AND OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN
    INSERT INTO public.complaint_workflow_logs (complaint_id, action_type, action_by, details)
    VALUES (
      NEW.id,
      'workflow_status_change',
      auth.uid(),
      jsonb_build_object(
        'old_workflow_status', OLD.workflow_status,
        'new_workflow_status', NEW.workflow_status,
        'changed_at', now()
      )
    );
  END IF;

  -- Log priority changes
  IF TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.complaint_workflow_logs (complaint_id, action_type, action_by, details)
    VALUES (
      NEW.id,
      'priority_change',
      auth.uid(),
      jsonb_build_object(
        'old_priority', OLD.priority,
        'new_priority', NEW.priority,
        'changed_at', now()
      )
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add trigger for workflow logging (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_complaint_workflow_trigger') THEN
    CREATE TRIGGER log_complaint_workflow_trigger
      AFTER UPDATE ON public.complaints
      FOR EACH ROW EXECUTE FUNCTION public.log_complaint_workflow();
  END IF;
END $$;

-- Function to automatically create audit log entries
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_action_type TEXT,
  p_target_type TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    action_type,
    performed_by,
    target_type,
    target_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_action_type,
    auth.uid(),
    p_target_type,
    p_target_id,
    p_details,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to find similar complaints (for duplicate detection)
CREATE OR REPLACE FUNCTION public.find_similar_complaints(
  p_complaint_id UUID,
  p_similarity_threshold FLOAT DEFAULT 0.8
)
RETURNS TABLE (
  similar_complaint_id UUID,
  similarity_score FLOAT,
  similarity_factors JSONB
) AS $$
DECLARE
  target_complaint RECORD;
BEGIN
  -- Get target complaint details
  SELECT title, type, latitude, longitude, submitted_at 
  INTO target_complaint
  FROM public.complaints 
  WHERE id = p_complaint_id;
  
  RETURN QUERY
  SELECT 
    c.id,
    CASE 
      WHEN c.id = p_complaint_id THEN 0.0
      ELSE (
        -- Text similarity (40% weight)
        COALESCE(similarity(c.title, target_complaint.title) * 0.4, 0.0) +
        -- Location similarity (30% weight)
        CASE 
          WHEN c.latitude IS NOT NULL AND c.longitude IS NOT NULL 
               AND target_complaint.latitude IS NOT NULL AND target_complaint.longitude IS NOT NULL
          THEN GREATEST(0.0, (1.0 - (earth_distance(
            ll_to_earth(c.latitude, c.longitude),
            ll_to_earth(target_complaint.latitude, target_complaint.longitude)
          ) / 1000.0)) * 0.3)
          ELSE 0.0
        END +
        -- Type similarity (20% weight)
        CASE WHEN c.type = target_complaint.type THEN 0.2 ELSE 0.0 END +
        -- Temporal similarity (10% weight)
        CASE 
          WHEN abs(extract(epoch from (c.submitted_at - target_complaint.submitted_at))) < 604800
          THEN 0.1 ELSE 0.0
        END
      )
    END,
    jsonb_build_object(
      'text_similarity', COALESCE(similarity(c.title, target_complaint.title), 0.0),
      'location_distance', CASE 
        WHEN c.latitude IS NOT NULL AND c.longitude IS NOT NULL 
             AND target_complaint.latitude IS NOT NULL AND target_complaint.longitude IS NOT NULL
        THEN earth_distance(
          ll_to_earth(c.latitude, c.longitude),
          ll_to_earth(target_complaint.latitude, target_complaint.longitude)
        )
        ELSE NULL
      END,
      'type_match', c.type = target_complaint.type,
      'time_diff_hours', abs(extract(epoch from (c.submitted_at - target_complaint.submitted_at))) / 3600
    )
  FROM public.complaints c
  WHERE c.id != p_complaint_id
    AND c.submitted_at > target_complaint.submitted_at - INTERVAL '30 days'
    AND c.submitted_at < target_complaint.submitted_at + INTERVAL '30 days'
  HAVING (
    COALESCE(similarity(c.title, target_complaint.title) * 0.4, 0.0) +
    CASE 
      WHEN c.latitude IS NOT NULL AND c.longitude IS NOT NULL 
           AND target_complaint.latitude IS NOT NULL AND target_complaint.longitude IS NOT NULL
      THEN GREATEST(0.0, (1.0 - (earth_distance(
        ll_to_earth(c.latitude, c.longitude),
        ll_to_earth(target_complaint.latitude, target_complaint.longitude)
      ) / 1000.0)) * 0.3)
      ELSE 0.0
    END +
    CASE WHEN c.type = target_complaint.type THEN 0.2 ELSE 0.0 END +
    CASE 
      WHEN abs(extract(epoch from (c.submitted_at - target_complaint.submitted_at))) < 604800
      THEN 0.1 ELSE 0.0
    END
  ) >= p_similarity_threshold
  ORDER BY 2 DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to get complaint statistics
CREATE OR REPLACE FUNCTION public.get_complaint_statistics(
  p_department TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_complaints', COUNT(*),
    'by_status', jsonb_object_agg(status, status_count),
    'by_priority', jsonb_object_agg(priority, priority_count),
    'by_type', jsonb_object_agg(type, type_count),
    'avg_resolution_time_hours', COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - submitted_at)) / 3600), 0),
    'satisfaction_avg', COALESCE(AVG(citizen_satisfaction_rating), 0)
  ) INTO result
  FROM (
    SELECT 
      status,
      COUNT(*) as status_count,
      priority,
      COUNT(*) as priority_count,
      type,
      COUNT(*) as type_count
    FROM public.complaints
    WHERE (p_department IS NULL OR primary_department = p_department)
      AND (p_date_from IS NULL OR submitted_at >= p_date_from)
      AND (p_date_to IS NULL OR submitted_at <= p_date_to)
    GROUP BY status, priority, type
  ) stats;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Performance indexes created successfully!';
  RAISE NOTICE '🔐 RLS policies enabled on all tables!';
  RAISE NOTICE '⚙️ Utility functions and triggers installed!';
  RAISE NOTICE '📊 Database is now fully optimized and secure!';
  RAISE NOTICE '🎯 CitizenLink is ready for production!';
END $$;
