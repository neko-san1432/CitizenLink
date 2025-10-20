-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action_type character varying NOT NULL,
  performed_by uuid NOT NULL,
  target_type character varying,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.complaint_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  department_id uuid,
  assigned_by uuid NOT NULL,
  assigned_to uuid,
  status character varying NOT NULL DEFAULT 'pending'::character varying,
  rejection_reason text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  deadline timestamp with time zone,
  completed_at timestamp with time zone,
  CONSTRAINT complaint_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_assignments_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id),
  CONSTRAINT complaint_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id)
);
CREATE TABLE public.complaint_clusters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cluster_name text,
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  radius_meters double precision NOT NULL,
  complaint_ids ARRAY DEFAULT '{}'::uuid[],
  identified_at timestamp with time zone DEFAULT now(),
  pattern_type text CHECK (pattern_type = ANY (ARRAY['recurring'::text, 'outbreak'::text, 'normal'::text])),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'resolved'::text, 'dismissed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_clusters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.complaint_coordinators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  department text NOT NULL,
  is_active boolean DEFAULT true,
  assigned_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_coordinators_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_coordinators_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT complaint_coordinators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.complaint_duplicates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  master_complaint_id uuid NOT NULL,
  duplicate_complaint_id uuid NOT NULL UNIQUE,
  merged_by uuid NOT NULL,
  merged_at timestamp with time zone DEFAULT now(),
  merge_reason text,
  CONSTRAINT complaint_duplicates_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_duplicates_duplicate_complaint_id_fkey FOREIGN KEY (duplicate_complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_duplicates_master_complaint_id_fkey FOREIGN KEY (master_complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_duplicates_merged_by_fkey FOREIGN KEY (merged_by) REFERENCES auth.users(id)
);
CREATE TABLE public.complaint_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL,
  mime_type text,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone DEFAULT now(),
  is_public boolean DEFAULT false,
  CONSTRAINT complaint_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_evidence_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_evidence_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);
CREATE TABLE public.complaint_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  action_type character varying NOT NULL,
  performed_by uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT complaint_history_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_history_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.complaint_similarities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  similar_complaint_id uuid NOT NULL,
  similarity_score double precision NOT NULL CHECK (similarity_score >= 0::double precision AND similarity_score <= 1::double precision),
  similarity_factors jsonb DEFAULT '{}'::jsonb,
  detected_at timestamp with time zone DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  coordinator_decision text CHECK (coordinator_decision = ANY (ARRAY['duplicate'::text, 'related'::text, 'unique'::text, 'false_positive'::text])),
  CONSTRAINT complaint_similarities_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_similarities_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_similarities_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id),
  CONSTRAINT complaint_similarities_similar_complaint_id_fkey FOREIGN KEY (similar_complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.complaint_workflow_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  action_type text NOT NULL,
  action_by uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_workflow_logs_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_workflow_logs_action_by_fkey FOREIGN KEY (action_by) REFERENCES auth.users(id),
  CONSTRAINT complaint_workflow_logs_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  subtype text,
  descriptive_su text NOT NULL,
  location_text text,
  latitude double precision,
  longitude double precision,
  department_r ARRAY DEFAULT '{}'::text[],
  status text DEFAULT 'pending review'::text CHECK (status = ANY (ARRAY['pending review'::text, 'in progress'::text, 'resolved'::text, 'rejected'::text, 'closed'::text])),
  workflow_status text DEFAULT 'new'::text CHECK (workflow_status = ANY (ARRAY['new'::text, 'assigned'::text, 'in_progress'::text, 'pending_approval'::text, 'completed'::text, 'cancelled'::text])),
  priority text DEFAULT 'low'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  evidence jsonb DEFAULT '[]'::jsonb,
  primary_department text,
  secondary_departments ARRAY DEFAULT '{}'::text[],
  assigned_coordinator_id uuid,
  response_deadline timestamp with time zone,
  citizen_satisfaction_rating integer CHECK (citizen_satisfaction_rating >= 1 AND citizen_satisfaction_rating <= 5),
  is_duplicate boolean DEFAULT false,
  master_complaint_id uuid,
  task_force_id uuid,
  coordinator_notes text,
  estimated_resolution_date timestamp with time zone,
  submitted_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT complaints_assigned_coordinator_id_fkey FOREIGN KEY (assigned_coordinator_id) REFERENCES auth.users(id),
  CONSTRAINT complaints_master_complaint_id_fkey FOREIGN KEY (master_complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaints_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id)
);
CREATE TABLE public.department_escalation_matrix (
  id bigint NOT NULL DEFAULT nextval('department_escalation_matrix_id_seq'::regclass),
  complaint_type text NOT NULL,
  keywords ARRAY DEFAULT '{}'::text[],
  primary_department text NOT NULL,
  secondary_departments ARRAY DEFAULT '{}'::text[],
  auto_assign boolean DEFAULT false,
  priority_boost integer DEFAULT 0 CHECK (priority_boost >= 0 AND priority_boost <= 2),
  response_deadline_hours integer DEFAULT 72 CHECK (response_deadline_hours > 0),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT department_escalation_matrix_pkey PRIMARY KEY (id),
  CONSTRAINT department_escalation_matrix_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.department_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_department text,
  to_department text NOT NULL,
  performed_by uuid NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT department_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT department_transfers_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id),
  CONSTRAINT department_transfers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.departments (
  id bigint NOT NULL DEFAULT nextval('departments_id_seq'::regclass),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  description text NOT NULL,
  location character varying,
  event_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone,
  image_url text,
  organizer character varying,
  category character varying,
  tags ARRAY DEFAULT '{}'::text[],
  status character varying DEFAULT 'upcoming'::character varying,
  max_participants integer,
  registration_required boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.invitation_tokens (
  token character varying NOT NULL,
  created_by uuid NOT NULL,
  role character varying NOT NULL,
  department_id uuid,
  employee_id_required boolean NOT NULL DEFAULT true,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invitation_tokens_pkey PRIMARY KEY (token),
  CONSTRAINT invitation_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.news (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  content text NOT NULL,
  excerpt text,
  image_url text,
  author_id uuid,
  category character varying,
  tags ARRAY DEFAULT '{}'::text[],
  status character varying DEFAULT 'draft'::character varying,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT news_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notice (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  owner uuid DEFAULT auth.uid(),
  CONSTRAINT notice_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  content text NOT NULL,
  priority character varying DEFAULT 'normal'::character varying,
  type character varying,
  target_audience ARRAY DEFAULT '{}'::text[],
  image_url text,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  status character varying DEFAULT 'active'::character varying,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.notification (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  type text NOT NULL,
  scope text,
  owner uuid DEFAULT auth.uid(),
  news_id bigint,
  complaint_id bigint,
  notice_id bigint,
  user_id uuid,
  priority text DEFAULT 'info'::text CHECK (priority = ANY (ARRAY['info'::text, 'warning'::text, 'urgent'::text])),
  title text,
  message text,
  icon text DEFAULT '📢'::text,
  link text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  read_at timestamp with time zone,
  expires_at timestamp with time zone,
  CONSTRAINT notification_pkey PRIMARY KEY (id),
  CONSTRAINT notification_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.role_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_role text NOT NULL,
  new_role text NOT NULL,
  performed_by uuid NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_changes_pkey PRIMARY KEY (id),
  CONSTRAINT role_changes_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id),
  CONSTRAINT role_changes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.settings (
  key text NOT NULL,
  value text NOT NULL,
  type text DEFAULT 'text'::text CHECK (type = ANY (ARRAY['text'::text, 'textarea'::text, 'html'::text, 'boolean'::text, 'number'::text, 'json'::text])),
  category text DEFAULT 'general'::text,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.signup_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  role character varying NOT NULL,
  department_code character varying,
  created_by uuid NOT NULL,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  used_at timestamp with time zone,
  used_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT signup_links_pkey PRIMARY KEY (id)
);
CREATE TABLE public.task_forces (
  id bigint NOT NULL DEFAULT nextval('task_forces_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  description text,
  departments ARRAY NOT NULL CHECK (array_length(departments, 1) >= 2),
  lead_department text NOT NULL,
  coordinator_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  ended_at timestamp with time zone,
  ended_by uuid,
  CONSTRAINT task_forces_pkey PRIMARY KEY (id),
  CONSTRAINT task_forces_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES auth.users(id),
  CONSTRAINT task_forces_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT task_forces_ended_by_fkey FOREIGN KEY (ended_by) REFERENCES auth.users(id)
);
CREATE TABLE public.upcomingEvents (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  owner uuid NOT NULL DEFAULT auth.uid(),
  CONSTRAINT upcomingEvents_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_role_history (
  id bigint NOT NULL DEFAULT nextval('user_role_history_id_seq'::regclass),
  user_id uuid NOT NULL,
  old_role text,
  new_role text NOT NULL,
  changed_by uuid,
  reason text,
  effective_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_role_history_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text,
  ip_address inet,
  user_agent text,
  device_type text,
  browser text,
  location_city text,
  location_country text,
  is_active boolean DEFAULT true,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  last_activity_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id)
);