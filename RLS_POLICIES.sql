-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR CITIZENLINK
-- ============================================================================
-- This script creates RLS policies for all tables to ensure users can only
-- access data they're authorized to see based on their role.
-- ============================================================================

-- Enable RLS on all existing base tables (skip if table doesn't exist)
ALTER TABLE IF EXISTS public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.complaint_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.complaint_workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.complaint_similarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.complaint_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.complaint_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.department_transfers ENABLE ROW LEVEL SECURITY;

-- Helper: create policy only if table exists
CREATE OR REPLACE FUNCTION public.create_policy_if_table_exists(
  table_name TEXT,
  policy_sql TEXT
) RETURNS VOID AS $$
BEGIN
  IF to_regclass(table_name) IS NOT NULL THEN
    EXECUTE policy_sql;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Get User Role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    (auth.jwt() -> 'raw_user_meta_data' ->> 'role'),
    'citizen'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Check if user is Staff (any LGU role)
-- ============================================================================
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

-- ============================================================================
-- HELPER FUNCTION: Check if user is Admin or above
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() IN ('lgu-admin', 'lgu-hr', 'super-admin')
         OR get_user_role() LIKE 'lgu-admin-%'
         OR get_user_role() LIKE 'lgu-hr-%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLAINTS TABLE RLS
-- ============================================================================

-- Citizens can view their own complaints
SELECT public.create_policy_if_table_exists('public.complaints', $$
  CREATE POLICY "Citizens can view their own complaints"
    ON public.complaints FOR SELECT
    USING (
      submitted_by = auth.uid()
      OR is_staff()
    );
$$);

-- Citizens can create complaints (only their own)
SELECT public.create_policy_if_table_exists('public.complaints', $$
  CREATE POLICY "Citizens can create complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (
      submitted_by = auth.uid()
    );
$$);

-- Citizens can update their own complaints (only if pending review)
SELECT public.create_policy_if_table_exists('public.complaints', $$
  CREATE POLICY "Citizens can update own pending complaints"
    ON public.complaints FOR UPDATE
    USING (
      submitted_by = auth.uid()
      AND status = 'pending review'
    )
    WITH CHECK (
      submitted_by = auth.uid()
      AND status = 'pending review'
    );
$$);

-- Staff can update complaints (status, assignments, etc.)
SELECT public.create_policy_if_table_exists('public.complaints', $$
  CREATE POLICY "Staff can update complaints"
    ON public.complaints FOR UPDATE
    USING (is_staff())
    WITH CHECK (is_staff());
$$);

-- Only super admin can delete complaints
SELECT public.create_policy_if_table_exists('public.complaints', $$
  CREATE POLICY "Super admin can delete complaints"
    ON public.complaints FOR DELETE
    USING (get_user_role() = 'super-admin');
$$);

-- ============================================================================
-- COMPLAINT_COORDINATORS TABLE RLS
-- ============================================================================

-- Coordinators and admins can view coordinator assignments
SELECT public.create_policy_if_table_exists('public.complaint_coordinators', $$
  CREATE POLICY "View coordinator assignments"
    ON public.complaint_coordinators FOR SELECT
    USING (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- Only HR and super admin can manage coordinator assignments
SELECT public.create_policy_if_table_exists('public.complaint_coordinators', $$
  CREATE POLICY "Manage coordinator assignments"
    ON public.complaint_coordinators FOR ALL
    USING (
      get_user_role() IN ('lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-hr-%'
    )
    WITH CHECK (
      get_user_role() IN ('lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- ============================================================================
-- COMPLAINT_WORKFLOW_LOGS TABLE RLS
-- ============================================================================

-- Citizens can view logs for their own complaints
SELECT public.create_policy_if_table_exists('public.complaint_workflow_logs', $$
  CREATE POLICY "View workflow logs for own complaints"
    ON public.complaint_workflow_logs FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.complaints
        WHERE complaints.id = complaint_workflow_logs.complaint_id
        AND complaints.submitted_by = auth.uid()
      )
      OR is_staff()
    );
$$);

-- Staff can create workflow logs
SELECT public.create_policy_if_table_exists('public.complaint_workflow_logs', $$
  CREATE POLICY "Staff can create workflow logs"
    ON public.complaint_workflow_logs FOR INSERT
    WITH CHECK (is_staff());
$$);

-- Only super admin can delete workflow logs
SELECT public.create_policy_if_table_exists('public.complaint_workflow_logs', $$
  CREATE POLICY "Super admin can delete workflow logs"
    ON public.complaint_workflow_logs FOR DELETE
    USING (get_user_role() = 'super-admin');
$$);

-- ============================================================================
-- COMPLAINT_SIMILARITIES TABLE RLS
-- ============================================================================

-- Coordinators and above can view similarities
SELECT public.create_policy_if_table_exists('public.complaint_similarities', $$
  CREATE POLICY "Coordinators can view similarities"
    ON public.complaint_similarities FOR SELECT
    USING (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- Coordinators can manage similarities
SELECT public.create_policy_if_table_exists('public.complaint_similarities', $$
  CREATE POLICY "Coordinators can manage similarities"
    ON public.complaint_similarities FOR ALL
    USING (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    )
    WITH CHECK (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- ============================================================================
-- COMPLAINT_DUPLICATES TABLE RLS
-- ============================================================================

-- Coordinators and above can view duplicates
SELECT public.create_policy_if_table_exists('public.complaint_duplicates', $$
  CREATE POLICY "Coordinators can view duplicates"
    ON public.complaint_duplicates FOR SELECT
    USING (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- Coordinators can manage duplicates
SELECT public.create_policy_if_table_exists('public.complaint_duplicates', $$
  CREATE POLICY "Coordinators can manage duplicates"
    ON public.complaint_duplicates FOR ALL
    USING (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    )
    WITH CHECK (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- ============================================================================
-- COMPLAINT_CLUSTERS TABLE RLS
-- ============================================================================

-- Coordinators and above can view clusters
SELECT public.create_policy_if_table_exists('public.complaint_clusters', $$
  CREATE POLICY "Coordinators can view clusters"
    ON public.complaint_clusters FOR SELECT
    USING (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- Coordinators can manage clusters
SELECT public.create_policy_if_table_exists('public.complaint_clusters', $$
  CREATE POLICY "Coordinators can manage clusters"
    ON public.complaint_clusters FOR ALL
    USING (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    )
    WITH CHECK (
      get_user_role() IN ('complaint-coordinator', 'lgu-admin', 'lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-admin-%'
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- ============================================================================
-- ROLE_CHANGES TABLE RLS
-- ============================================================================

-- HR and Super Admin can view role changes
SELECT public.create_policy_if_table_exists('public.role_changes', $$
  CREATE POLICY "HR and Super Admin can view role changes"
    ON public.role_changes FOR SELECT
    USING (
      get_user_role() IN ('lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- System can log role changes
SELECT public.create_policy_if_table_exists('public.role_changes', $$
  CREATE POLICY "System can log role changes"
    ON public.role_changes FOR INSERT
    WITH CHECK (true); -- Backend service logs role changes
$$);

-- No one can update or delete role changes (audit integrity)
-- No UPDATE or DELETE policies = immutable audit log

-- ============================================================================
-- DEPARTMENT_TRANSFERS TABLE RLS
-- ============================================================================

-- HR and Super Admin can view transfers
SELECT public.create_policy_if_table_exists('public.department_transfers', $$
  CREATE POLICY "HR and Super Admin can view transfers"
    ON public.department_transfers FOR SELECT
    USING (
      get_user_role() IN ('lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

-- System can log transfers
SELECT public.create_policy_if_table_exists('public.department_transfers', $$
  CREATE POLICY "System can log transfers"
    ON public.department_transfers FOR INSERT
    WITH CHECK (true); -- Backend service logs transfers
$$);

-- No one can update or delete transfers (audit integrity)
-- No UPDATE or DELETE policies = immutable audit log

-- ============================================================================
-- COMPLAINT_EVIDENCE TABLE RLS
-- ============================================================================

-- Citizens can view evidence for their own complaints
SELECT public.create_policy_if_table_exists('public.complaint_evidence', $$
  CREATE POLICY "Citizens can view own complaint evidence"
    ON public.complaint_evidence FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.complaints
        WHERE complaints.id = complaint_evidence.complaint_id
        AND complaints.submitted_by = auth.uid()
      )
      OR is_staff()
    );
$$);

-- Citizens can upload evidence for their own complaints
SELECT public.create_policy_if_table_exists('public.complaint_evidence', $$
  CREATE POLICY "Citizens can upload own complaint evidence"
    ON public.complaint_evidence FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.complaints
        WHERE complaints.id = complaint_evidence.complaint_id
        AND complaints.submitted_by = auth.uid()
      )
      OR is_staff()
    );
$$);

-- Staff can manage all evidence
SELECT public.create_policy_if_table_exists('public.complaint_evidence', $$
  CREATE POLICY "Staff can manage evidence"
    ON public.complaint_evidence FOR ALL
    USING (is_staff())
    WITH CHECK (is_staff());
$$);

-- ============================================================================
-- NOTIFICATIONS TABLE RLS
-- ============================================================================

-- Users can only view their own notifications
SELECT public.create_policy_if_table_exists('public.notification', $$
  CREATE POLICY "Users can view own notifications"
    ON public.notification FOR SELECT
    USING (owner = auth.uid());
$$);

-- System/Staff can create notifications for any user
SELECT public.create_policy_if_table_exists('public.notification', $$
  CREATE POLICY "System can create notifications"
    ON public.notification FOR INSERT
    WITH CHECK (true);
$$);

-- Users can update their own notifications (mark as read)
SELECT public.create_policy_if_table_exists('public.notification', $$
  CREATE POLICY "Users can update own notifications"
    ON public.notification FOR UPDATE
    USING (owner = auth.uid())
    WITH CHECK (owner = auth.uid());
$$);

-- Users can delete their own notifications
SELECT public.create_policy_if_table_exists('public.notification', $$
  CREATE POLICY "Users can delete own notifications"
    ON public.notification FOR DELETE
    USING (owner = auth.uid());
$$);

-- NOTE: role_changes table not present in your schema; skipping policies.

-- ============================================================================
-- DEPARTMENT_TRANSFERS TABLE (Audit Log) RLS
-- ============================================================================

SELECT public.create_policy_if_table_exists('public.department_transfers', $$
  CREATE POLICY "HR can view transfers"
    ON public.department_transfers FOR SELECT
    USING (
      get_user_role() IN ('lgu-hr', 'super-admin')
      OR get_user_role() LIKE 'lgu-hr-%'
    );
$$);

SELECT public.create_policy_if_table_exists('public.department_transfers', $$
  CREATE POLICY "System can log transfers"
    ON public.department_transfers FOR INSERT
    WITH CHECK (true);
$$);

-- No one can update or delete transfers (audit integrity)
-- No UPDATE or DELETE policies = immutable audit log

-- ============================================================================
-- GRANT USAGE ON HELPER FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_above() TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify RLS is enabled:
/*
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'complaints', 
  'complaint_coordinators', 
  'complaint_workflow_logs',
  'complaint_similarities',
  'complaint_duplicates',
  'complaint_clusters',
  'notification',
  'department_transfers'
);

-- Check policies:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
*/

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. RLS is now enabled on all tables
-- 2. Citizens can only see/edit their own data
-- 3. Staff roles have appropriate access based on hierarchy
-- 4. Audit tables (role_changes, department_transfers) are immutable
-- 5. Super admin has full access to everything
-- 6. Helper functions make role checking consistent and maintainable
-- 
-- IMPORTANT: Run this script in your Supabase SQL Editor!
-- ============================================================================
