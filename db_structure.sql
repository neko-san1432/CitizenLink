-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.complaint_departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  department_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'collaborator'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'in_progress'::text, 'resolved'::text, 'rejected'::text])),
  assigned_admin_id uuid,
  assigned_officer_id uuid,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.complaint_evidences (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text])),
  mime text NOT NULL,
  url text NOT NULL,
  caption text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT complaint_evidences_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_evidences_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id)
);
CREATE TABLE public.complaints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  user_name character varying NOT NULL,
  title character varying NOT NULL,
  type character varying NOT NULL,
  subcategory character varying,
  location text NOT NULL,
  description text NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'in_progress'::character varying::text, 'resolved'::character varying::text, 'rejected'::character varying::text])),
  assigned_unit character varying,
  citizen_feedback text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  is_active boolean DEFAULT true,
  latitude numeric,
  longitude numeric,
  location_accuracy numeric,
  location_timestamp timestamp with time zone,
  location_source character varying DEFAULT 'gps'::character varying CHECK (location_source::text = ANY (ARRAY['gps'::character varying::text, 'manual'::character varying::text, 'estimated'::character varying::text])),
  suggested_unit character varying,
  satisfaction_score numeric CHECK (satisfaction_score >= 1.0 AND satisfaction_score <= 5.0),
  urgency character varying DEFAULT 'medium'::character varying CHECK (urgency::text = ANY (ARRAY['low'::character varying::text, 'medium'::character varying::text, 'high'::character varying::text, 'critical'::character varying::text])),
  priority character varying DEFAULT 'medium'::character varying CHECK (priority::text = ANY (ARRAY['low'::character varying::text, 'medium'::character varying::text, 'high'::character varying::text, 'critical'::character varying::text])),
  media_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_file_count integer NOT NULL DEFAULT 0,
  temp_complaint_id text,
  is_anonymous boolean NOT NULL DEFAULT false,
  department text,
  CONSTRAINT complaints_pkey PRIMARY KEY (id)
);
CREATE TABLE public.department_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  department_id uuid,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  CONSTRAINT department_admins_pkey PRIMARY KEY (id)
);
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  description text,
  code character varying NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.important_notice_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  priority character varying DEFAULT 'medium'::character varying CHECK (priority::text = ANY (ARRAY['low'::character varying::text, 'medium'::character varying::text, 'high'::character varying::text, 'critical'::character varying::text])),
  category character varying NOT NULL,
  content text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  is_urgent boolean DEFAULT false,
  requires_action boolean DEFAULT false,
  action_required text,
  contact_info text,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying::text, 'inactive'::character varying::text, 'expired'::character varying::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  view_count integer DEFAULT 0,
  acknowledgment_required boolean DEFAULT false,
  CONSTRAINT important_notice_data_pkey PRIMARY KEY (id)
);
CREATE TABLE public.news_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  excerpt text NOT NULL,
  content text NOT NULL,
  category character varying NOT NULL,
  icon character varying,
  author character varying NOT NULL,
  read_time character varying,
  status character varying DEFAULT 'draft'::character varying CHECK (status::text = ANY (ARRAY['draft'::character varying::text, 'published'::character varying::text, 'archived'::character varying::text])),
  featured boolean DEFAULT false,
  tags ARRAY DEFAULT '{}'::text[],
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  published_at timestamp with time zone,
  view_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  CONSTRAINT news_data_pkey PRIMARY KEY (id)
);
CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  description text,
  resource character varying NOT NULL,
  action character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);
CREATE TABLE public.upcoming_events_data (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  category character varying NOT NULL,
  description text NOT NULL,
  event_date timestamp with time zone NOT NULL,
  location character varying NOT NULL,
  organizer character varying NOT NULL,
  contact_info text,
  registration_required boolean DEFAULT false,
  max_attendees integer,
  current_attendees integer DEFAULT 0,
  status character varying DEFAULT 'upcoming'::character varying CHECK (status::text = ANY (ARRAY['upcoming'::character varying::text, 'ongoing'::character varying::text, 'completed'::character varying::text, 'cancelled'::character varying::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  event_time time without time zone,
  image_url text,
  tags ARRAY DEFAULT '{}'::text[],
  CONSTRAINT upcoming_events_data_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_locations (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  location_name character varying,
  address text,
  city character varying,
  state character varying,
  country character varying DEFAULT 'Philippines'::character varying,
  postal_code character varying,
  location_type character varying DEFAULT 'residence'::character varying CHECK (location_type::text = ANY (ARRAY['residence'::character varying::text, 'work'::character varying::text, 'frequent'::character varying::text, 'temporary'::character varying::text])),
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email character varying NOT NULL UNIQUE,
  full_name character varying NOT NULL,
  phone character varying,
  address text,
  role text DEFAULT 'citizen'::text,
  department_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);