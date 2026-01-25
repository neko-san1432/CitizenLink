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
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.complaint_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  department_id bigint,
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
  assignment_type text DEFAULT 'single'::text CHECK (assignment_type = ANY (ARRAY['single'::text, 'multi'::text])),
  assignment_group_id uuid DEFAULT gen_random_uuid(),
  officer_order integer DEFAULT 1,
  CONSTRAINT complaint_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id),
  CONSTRAINT complaint_assignments_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id),
  CONSTRAINT complaint_assignments_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_assignments_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
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
  evidence_type text DEFAULT 'initial'::text CHECK (evidence_type = ANY (ARRAY['initial'::text, 'completion'::text])),
  CONSTRAINT complaint_evidence_pkey PRIMARY KEY (id),
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
  CONSTRAINT complaint_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.complaint_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  reminded_at timestamp with time zone DEFAULT now(),
  reminder_count integer DEFAULT 1,
  reminded_by uuid,
  reminder_type text DEFAULT 'manual'::text,
  CONSTRAINT complaint_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_reminders_reminded_by_fkey FOREIGN KEY (reminded_by) REFERENCES auth.users(id)
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
  CONSTRAINT complaint_similarities_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id)
);
CREATE TABLE public.complaint_upvotes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_upvotes_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_upvotes_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.complaint_workflow_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  action_type text NOT NULL,
  action_by uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_workflow_logs_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_workflow_logs_action_by_fkey FOREIGN KEY (action_by) REFERENCES auth.users(id)
);
CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL,
  descriptive_su text NOT NULL,
  location_text text,
  latitude double precision,
  longitude double precision,
  category text,
  subcategory text,
  department_r ARRAY DEFAULT '{}'::text[],
  preferred_departments jsonb DEFAULT '[]'::jsonb,
  workflow_status text DEFAULT 'new'::text CHECK (workflow_status = ANY (ARRAY['new'::text, 'assigned'::text, 'in_progress'::text, 'pending_approval'::text, 'completed'::text, 'cancelled'::text])),
  priority text DEFAULT 'low'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  assigned_coordinator_id uuid,
  response_deadline timestamp with time zone,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamp with time zone,
  confirmed_by_citizen boolean DEFAULT false,
  citizen_confirmation_date timestamp with time zone,
  is_duplicate boolean DEFAULT false,
  master_complaint_id uuid,
  task_force_id uuid,
  coordinator_notes text,
  estimated_resolution_date timestamp with time zone,
  submitted_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_activity_at timestamp with time zone DEFAULT now(),
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  cancelled_by uuid,
  status character varying DEFAULT 'pending'::character varying,
  all_responders_confirmed boolean DEFAULT false,
  responders_confirmation_date timestamp with time zone,
  confirmation_status text DEFAULT 'pending'::text CHECK (confirmation_status = ANY (ARRAY['pending'::text, 'waiting_for_responders'::text, 'waiting_for_complainant'::text, 'confirmed'::text, 'disputed'::text])),
  urgency_level text DEFAULT 'medium'::text CHECK (urgency_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  upvote_count integer DEFAULT 0,
  citizen_satisfaction_rating integer,
  title text DEFAULT 'Untitled Complaint'::text,
  submitted_by_snapshot jsonb,
  account_preservation_data jsonb,
  original_submitter_id uuid,
  CONSTRAINT complaints_pkey PRIMARY KEY (id),
  CONSTRAINT complaints_assigned_coordinator_id_fkey FOREIGN KEY (assigned_coordinator_id) REFERENCES auth.users(id),
  CONSTRAINT complaints_master_complaint_id_fkey FOREIGN KEY (master_complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaints_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id),
  CONSTRAINT complaints_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id),
  CONSTRAINT complaints_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id)
);
CREATE TABLE public.department_subcategory_mapping (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  department_id bigint NOT NULL,
  subcategory_id uuid NOT NULL,
  is_primary boolean DEFAULT false,
  response_priority integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT department_subcategory_mapping_pkey PRIMARY KEY (id),
  CONSTRAINT department_subcategory_mapping_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT department_subcategory_mapping_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id)
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
  subcategory_id uuid,
  level text DEFAULT 'LGU'::text CHECK (level = ANY (ARRAY['LGU'::text, 'NGA'::text])),
  contact_info jsonb DEFAULT '{}'::jsonb,
  response_time_hours integer DEFAULT 24,
  escalation_time_hours integer DEFAULT 72,
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id)
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
CREATE TABLE public.id_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  id_number text NOT NULL,
  id_type text NOT NULL,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_status text NOT NULL DEFAULT 'pending'::text CHECK (verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text, 'flagged'::text])),
  confidence_score numeric CHECK (confidence_score >= 0::numeric AND confidence_score <= 100::numeric),
  verified_at timestamp with time zone,
  verified_by uuid,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT id_verifications_pkey PRIMARY KEY (id),
  CONSTRAINT id_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT id_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id)
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
CREATE TABLE public.nlp_anchors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text,
  anchor_text text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_anchors_pkey PRIMARY KEY (id),
  CONSTRAINT nlp_anchors_category_fkey FOREIGN KEY (category) REFERENCES public.nlp_category_config(category)
);
CREATE TABLE public.nlp_category_config (
  category text NOT NULL,
  parent_category text,
  urgency_rating integer DEFAULT 30 CHECK (urgency_rating >= 0 AND urgency_rating <= 100),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_category_config_pkey PRIMARY KEY (category)
);
CREATE TABLE public.nlp_dictionary_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_type USER-DEFINED NOT NULL,
  pattern text NOT NULL,
  translation text,
  multiplier numeric,
  action text,
  is_current_emergency boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_dictionary_rules_pkey PRIMARY KEY (id),
  CONSTRAINT nlp_dictionary_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.nlp_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  term text NOT NULL UNIQUE,
  category text NOT NULL,
  subcategory text,
  language text DEFAULT 'all'::text,
  confidence numeric DEFAULT 0.8 CHECK (confidence >= 0::numeric AND confidence <= 1.0),
  translation text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_keywords_pkey PRIMARY KEY (id),
  CONSTRAINT nlp_keywords_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.nlp_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid,
  input_text text,
  detected_category text,
  detected_urgency integer,
  method_used text,
  confidence_score numeric,
  processing_time_ms numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_logs_pkey PRIMARY KEY (id),
  CONSTRAINT nlp_logs_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.nlp_metaphors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  literal_meaning text,
  actual_meaning text,
  filter_type text,
  is_emergency boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_metaphors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.nlp_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type USER-DEFINED NOT NULL,
  data jsonb NOT NULL,
  status USER-DEFINED DEFAULT 'pending_coordinator'::nlp_proposal_status,
  submitted_by uuid NOT NULL,
  coordinator_approved_by uuid,
  super_admin_approved_by uuid,
  rejected_by uuid,
  rejection_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_proposals_pkey PRIMARY KEY (id),
  CONSTRAINT nlp_proposals_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id),
  CONSTRAINT nlp_proposals_coord_fkey FOREIGN KEY (coordinator_approved_by) REFERENCES auth.users(id),
  CONSTRAINT nlp_proposals_admin_fkey FOREIGN KEY (super_admin_approved_by) REFERENCES auth.users(id)
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
CREATE TABLE public.rate_limits (
  key text NOT NULL,
  requests jsonb DEFAULT '[]'::jsonb,
  reset_time timestamp with time zone,
  window_ms bigint,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rate_limits_pkey PRIMARY KEY (key)
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
CREATE TABLE public.subcategories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subcategories_pkey PRIMARY KEY (id),
  CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
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
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  role text DEFAULT 'citizen'::text,
  department text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
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