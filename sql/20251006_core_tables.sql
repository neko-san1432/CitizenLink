-- CitizenLink Core Tables per LGU Complaint Management System Specification
-- Date: 2025-10-06

-- Note: These statements are designed for PostgreSQL/Supabase.
-- They are idempotent where possible using IF NOT EXISTS.

-- 1) Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  code varchar(50) UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Invitation Tokens (for HR and Superadmin-controlled registrations)
CREATE TABLE IF NOT EXISTS public.invitation_tokens (
  token varchar(128) PRIMARY KEY,
  created_by uuid NOT NULL,
  role varchar(100) NOT NULL,
  department_id uuid NULL REFERENCES public.departments(id) ON DELETE SET NULL,
  employee_id_required boolean NOT NULL DEFAULT true,
  max_uses int NOT NULL DEFAULT 1,
  uses int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitation_tokens_active_expires
  ON public.invitation_tokens (active, expires_at);

-- 3) Complaint Assignments (department routing and assignments)
CREATE TABLE IF NOT EXISTS public.complaint_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL,
  assigned_to uuid NULL,
  status varchar(50) NOT NULL DEFAULT 'pending', -- pending | accepted | rejected
  rejection_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_complaint
  ON public.complaint_assignments (complaint_id);

CREATE INDEX IF NOT EXISTS idx_complaint_assignments_status
  ON public.complaint_assignments (status);

-- 4) Audit Logs (system-wide)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NULL,
  action varchar(255) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  ip_address varchar(64) NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs (action, created_at DESC);

-- 5) Complaint History (per-complaint timeline)
CREATE TABLE IF NOT EXISTS public.complaint_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  actor_id uuid NULL,
  action varchar(100) NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_history_complaint_created
  ON public.complaint_history (complaint_id, created_at DESC);

-- Optional: lightweight RLS scaffolding (commented - configure in Supabase UI as needed)
-- alter table public.invitation_tokens enable row level security;
-- alter table public.complaint_assignments enable row level security;
-- alter table public.audit_logs enable row level security;
-- alter table public.complaint_history enable row level security;







