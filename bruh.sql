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

-- Sample data for testing different roles

-- Insert sample departments (no hardcoded UUIDs)
INSERT INTO public.departments (name, description, code) VALUES
('Public Works and Highways', 'Handles infrastructure, roads, and public facilities', 'DPWH'),
('Health Services', 'Provides healthcare and medical services', 'DHS'),
('Social Welfare', 'Social services and community assistance', 'DSW'),
('Environment and Natural Resources', 'Environmental protection and natural resources', 'DENR'),
('Public Safety', 'Police, fire, and emergency services', 'DPS')
ON CONFLICT (code) DO NOTHING;

-- Insert sample complaints (no hardcoded UUIDs)
INSERT INTO public.complaints (user_id, user_name, title, type, subcategory, location, description, status, suggested_unit, urgency, priority, created_at) VALUES
-- Citizen complaints (general public)
(NULL, 'Juan Dela Cruz', 'Pothole on Main Street', 'Infrastructure', 'Roads', 'Main Street, Barangay 1', 'Large pothole causing traffic and vehicle damage', 'pending', 'DPWH', 'high', 'high', '2024-01-15 08:00:00+08'),
(NULL, 'Maria Santos', 'Streetlight not working', 'Infrastructure', 'Lighting', 'Corner of Rizal and Bonifacio St.', 'Streetlight has been out for 3 days', 'pending', 'DPWH', 'medium', 'medium', '2024-01-16 19:30:00+08'),
(NULL, 'Pedro Martinez', 'Garbage collection irregular', 'Sanitation', 'Waste Management', 'Barangay 2, Zone 3', 'Garbage not collected for 5 days', 'pending', 'DENR', 'high', 'high', '2024-01-17 07:15:00+08'),

-- LGU Staff/Officer complaints (internal issues)
(NULL, 'Officer Garcia', 'Office equipment malfunction', 'Administrative', 'Equipment', 'City Hall, 2nd Floor', 'Printer not working properly', 'in_progress', 'DPWH', 'low', 'low', '2024-01-18 09:00:00+08'),
(NULL, 'Staff Rodriguez', 'Air conditioning issue', 'Facilities', 'HVAC', 'Health Center, Room 5', 'AC unit making loud noise', 'pending', 'DPWH', 'medium', 'medium', '2024-01-19 14:20:00+08'),

-- LGU Admin complaints (department management)
(NULL, 'Admin Lopez', 'Budget allocation needed', 'Administrative', 'Finance', 'City Hall, Finance Office', 'Additional budget needed for Q2 projects', 'pending', 'DPS', 'high', 'high', '2024-01-20 10:30:00+08'),
(NULL, 'Admin Torres', 'Staff training required', 'Human Resources', 'Training', 'Social Welfare Office', 'Staff needs updated training on new policies', 'pending', 'DSW', 'medium', 'medium', '2024-01-21 11:45:00+08'),

-- Superadmin complaints (system-wide issues)
(NULL, 'Super Admin', 'System security audit needed', 'IT', 'Security', 'City Hall, IT Department', 'Annual security audit required for all systems', 'pending', 'DPS', 'critical', 'critical', '2024-01-22 08:15:00+08'),
(NULL, 'Super Admin', 'Inter-department coordination', 'Administrative', 'Coordination', 'City Hall, All Departments', 'Need better coordination between departments', 'pending', 'DPS', 'high', 'high', '2024-01-23 16:00:00+08'),

-- Multi-department complaints (collaboration needed)
(NULL, 'Citizen Group', 'Flooding in residential area', 'Disaster', 'Flooding', 'Barangay 3, Low-lying Area', 'Heavy rain causing flooding, needs drainage and health support', 'pending', 'DPWH,DENR,DHS', 'critical', 'critical', '2024-01-24 12:00:00+08'),
(NULL, 'Business Owner', 'Market area improvement', 'Infrastructure', 'Market Development', 'Public Market, Zone 1', 'Market needs renovation and health inspection', 'pending', 'DPWH,DHS,DSW', 'medium', 'medium', '2024-01-25 09:30:00+08');

-- Link complaints to departments using lookups (no hardcoded UUIDs)
-- Single department complaints
INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Road maintenance needed'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPWH'
WHERE c.title = 'Pothole on Main Street'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Electrical issue'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPWH'
WHERE c.title = 'Streetlight not working'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Waste management issue'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DENR'
WHERE c.title = 'Garbage collection irregular'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'in_progress', 'Equipment repair in progress'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPWH'
WHERE c.title = 'Office equipment malfunction'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'HVAC maintenance needed'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPWH'
WHERE c.title = 'Air conditioning issue'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Budget review required'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPS'
WHERE c.title = 'Budget allocation needed'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Training coordination needed'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DSW'
WHERE c.title = 'Staff training required'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Security audit planning'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPS'
WHERE c.title = 'System security audit needed'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Inter-department meeting needed'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPS'
WHERE c.title = 'Inter-department coordination'
ON CONFLICT DO NOTHING;

-- Multi-department: Flooding in residential area
INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Drainage system improvement'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPWH'
WHERE c.title = 'Flooding in residential area'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'collaborator', 'pending', 'Environmental assessment needed'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DENR'
WHERE c.title = 'Flooding in residential area'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'collaborator', 'pending', 'Health monitoring required'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DHS'
WHERE c.title = 'Flooding in residential area'
ON CONFLICT DO NOTHING;

-- Multi-department: Market area improvement
INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'owner', 'pending', 'Infrastructure renovation'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DPWH'
WHERE c.title = 'Market area improvement'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'collaborator', 'pending', 'Health and safety inspection'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DHS'
WHERE c.title = 'Market area improvement'
ON CONFLICT DO NOTHING;

INSERT INTO public.complaint_departments (complaint_id, department_id, role, status, notes)
SELECT c.id, d.id, 'collaborator', 'pending', 'Social impact assessment'
FROM public.complaints c
JOIN public.departments d ON d.code = 'DSW'
WHERE c.title = 'Market area improvement'
ON CONFLICT DO NOTHING;

-- Create users from user_admin.json (mapped)
-- Note: Mapping roles to departments: dpwh->DPWH, hlt->DHS, wst->DENR, pnp->DPS, bfp->DPS

-- citizen
INSERT INTO public.users (email, full_name, role)
VALUES ('citizen@gmail.com', 'Juan Dela Cruz', 'citizen')
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, updated_at = now();

-- superadmin
INSERT INTO public.users (email, full_name, role)
VALUES ('super-admin@gmail.com', 'System Owner', 'superadmin')
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, updated_at = now();

-- LGU Admins
INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-admin-dpwh@gmail.com', 'DPWH Admin', 'lgu-admin-dpwh', d.id FROM public.departments d WHERE d.code = 'DPWH'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-admin-bfp@gmail.com', 'BFP Admin', 'lgu-admin-bfp', d.id FROM public.departments d WHERE d.code = 'DPS'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-admin-pnp@gmail.com', 'PNP Admin', 'lgu-admin-pnp', d.id FROM public.departments d WHERE d.code = 'DPS'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-admin-hlt@gmail.com', 'HLT Admin', 'lgu-admin-hlt', d.id FROM public.departments d WHERE d.code = 'DHS'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-admin-wst@gmail.com', 'WST Admin', 'lgu-admin-wst', d.id FROM public.departments d WHERE d.code = 'DENR'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

-- LGU Officers/Staff
INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-dpwh@gmail.com', 'DPWH Officer', 'lgu-dpwh', d.id FROM public.departments d WHERE d.code = 'DPWH'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-bfp@gmail.com', 'BFP Officer', 'lgu-bfp', d.id FROM public.departments d WHERE d.code = 'DPS'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-pnp@gmail.com', 'PNP Officer', 'lgu-pnp', d.id FROM public.departments d WHERE d.code = 'DPS'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-hlt@gmail.com', 'HLT Staff', 'lgu-hlt', d.id FROM public.departments d WHERE d.code = 'DHS'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

INSERT INTO public.users (email, full_name, role, department_id)
SELECT 'lgu-wst@gmail.com', 'WST Staff', 'lgu-wst', d.id FROM public.departments d WHERE d.code = 'DENR'
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id, updated_at = now();

-- Assign department_admins from admin users
INSERT INTO public.department_admins (user_id, department_id, assigned_by)
SELECT u.id, d.id, su.id
FROM public.users u
JOIN public.departments d ON (
  (u.role = 'lgu-admin-dpwh' AND d.code = 'DPWH') OR
  (u.role = 'lgu-admin-bfp' AND d.code = 'DPS') OR
  (u.role = 'lgu-admin-pnp' AND d.code = 'DPS') OR
  (u.role = 'lgu-admin-hlt' AND d.code = 'DHS') OR
  (u.role = 'lgu-admin-wst' AND d.code = 'DENR')
)
LEFT JOIN public.users su ON su.email = 'super-admin@gmail.com'
WHERE u.role LIKE 'lgu-admin-%'
ON CONFLICT DO NOTHING;