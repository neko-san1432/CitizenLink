-- CitizenLink Schema Delta (Additive Changes Only)
-- Purpose: Align existing schema with required fields without dropping data
-- Date: 2025-10-06

-- 1) Complaints: ensure routing and workflow columns exist
ALTER TABLE IF EXISTS public.complaints
  ADD COLUMN IF NOT EXISTS department_r text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS primary_department text NULL,
  ADD COLUMN IF NOT EXISTS secondary_departments text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS workflow_status varchar(50) DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS response_deadline timestamptz NULL,
  ADD COLUMN IF NOT EXISTS coordinator_notes text NULL,
  ADD COLUMN IF NOT EXISTS assigned_coordinator_id uuid NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Helpful indexes for queries and dashboards
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);
CREATE INDEX IF NOT EXISTS idx_complaints_type ON public.complaints (type);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_at ON public.complaints (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_primary_department ON public.complaints (primary_department);

-- 2) Complaint Workflow Logs: ensure table exists (if not already created elsewhere)
CREATE TABLE IF NOT EXISTS public.complaint_workflow_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  action_type varchar(100) NOT NULL,
  action_by uuid NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cwl_complaint_created
  ON public.complaint_workflow_logs (complaint_id, created_at DESC);

-- 3) Complaint Similarities: create lightweight table if dedup logic in use
CREATE TABLE IF NOT EXISTS public.complaint_similarities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  similar_complaint_id uuid NOT NULL,
  similarity_score numeric(5,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_complaint_score
  ON public.complaint_similarities (complaint_id, similarity_score DESC);

-- 4) Departments: ensure minimal structure if missing
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  code varchar(50) UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);







