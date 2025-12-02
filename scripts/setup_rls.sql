-- Enable RLS on tables
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_reminders ENABLE ROW LEVEL SECURITY;

-- Create helper function to check if user is staff
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.jwt() ->> 'role' IN ('lgu-admin', 'lgu-officer', 'ocomplaint-coordinator', 'super-admin', 'hr')
    OR
    (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('lgu-admin', 'lgu-officer', 'complaint-coordinator', 'super-admin', 'hr')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check user department
CREATE OR REPLACE FUNCTION public.user_department()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'department',
    auth.jwt() -> 'user_metadata' ->> 'dpt'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- COMPLAINTS POLICIES

-- 1. Citizens can view their own complaints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaints' AND policyname = 'Citizens can view own complaints'
    ) THEN
        CREATE POLICY "Citizens can view own complaints"
        ON complaints FOR SELECT
        USING (auth.uid() = submitted_by);
    END IF;
END
$$;

-- 2. Citizens can insert complaints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaints' AND policyname = 'Citizens can insert complaints'
    ) THEN
        CREATE POLICY "Citizens can insert complaints"
        ON complaints FOR INSERT
        WITH CHECK (auth.uid() = submitted_by);
    END IF;
END
$$;

-- 3. Citizens can update their own complaints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaints' AND policyname = 'Citizens can update own complaints'
    ) THEN
        CREATE POLICY "Citizens can update own complaints"
        ON complaints FOR UPDATE
        USING (auth.uid() = submitted_by);
    END IF;
END
$$;

-- 4. Staff can view department complaints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaints' AND policyname = 'Staff can view department complaints'
    ) THEN
        CREATE POLICY "Staff can view department complaints"
        ON complaints FOR SELECT
        USING (
          public.is_staff() 
          AND (
            (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('super-admin', 'complaint-coordinator')
            OR
            (public.user_department() = ANY(department_r))
          )
        );
    END IF;
END
$$;

-- 5. Staff can update complaints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaints' AND policyname = 'Staff can update complaints'
    ) THEN
        CREATE POLICY "Staff can update complaints"
        ON complaints FOR UPDATE
        USING (
          public.is_staff()
          AND (
            (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('super-admin', 'complaint-coordinator')
            OR
            (public.user_department() = ANY(department_r))
          )
        );
    END IF;
END
$$;

-- COMPLAINT EVIDENCE POLICIES

-- 1. View evidence
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaint_evidence' AND policyname = 'View evidence'
    ) THEN
        CREATE POLICY "View evidence"
        ON complaint_evidence FOR SELECT
        USING (
          uploaded_by = auth.uid()
          OR
          EXISTS (
            SELECT 1 FROM complaints c
            WHERE c.id = complaint_evidence.complaint_id
            AND (
              c.submitted_by = auth.uid()
              OR
              (public.is_staff() AND (
                (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('super-admin', 'complaint-coordinator')
                OR
                (public.user_department() = ANY(c.department_r))
              ))
            )
          )
        );
    END IF;
END
$$;

-- 2. Insert evidence
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaint_evidence' AND policyname = 'Insert evidence'
    ) THEN
        CREATE POLICY "Insert evidence"
        ON complaint_evidence FOR INSERT
        WITH CHECK (auth.uid() = uploaded_by);
    END IF;
END
$$;

-- COMPLAINT ASSIGNMENTS POLICIES

-- 1. View assignments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaint_assignments' AND policyname = 'View assignments'
    ) THEN
        CREATE POLICY "View assignments"
        ON complaint_assignments FOR SELECT
        USING (
          public.is_staff()
          OR
          EXISTS (
            SELECT 1 FROM complaints c
            WHERE c.id = complaint_assignments.complaint_id
            AND c.submitted_by = auth.uid()
          )
        );
    END IF;
END
$$;

-- 2. Manage assignments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'complaint_assignments' AND policyname = 'Manage assignments'
    ) THEN
        CREATE POLICY "Manage assignments"
        ON complaint_assignments FOR ALL
        USING (
          (auth.jwt() -> 'user_metadata' ->> 'role')::text IN ('super-admin', 'complaint-coordinator', 'lgu-admin')
        );
    END IF;
END
$$;

