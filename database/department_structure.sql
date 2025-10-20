-- Department Structure Enhancement
-- Categories, Subcategories, and Departments with hierarchical relationships

-- Categories table (top-level grouping)
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  icon text, -- for UI display
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- Subcategories table (specific areas within categories)
CREATE TABLE IF NOT EXISTS public.subcategories (
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
  CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE,
  CONSTRAINT subcategories_code_unique UNIQUE (category_id, code)
);

-- Enhanced departments table with subcategory relationship
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS subcategory_id uuid,
ADD COLUMN IF NOT EXISTS level text DEFAULT 'LGU' CHECK (level IN ('LGU', 'NGA')),
ADD COLUMN IF NOT EXISTS contact_info jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS response_time_hours integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS escalation_time_hours integer DEFAULT 72;

-- Add foreign key constraint for subcategory
ALTER TABLE public.departments 
ADD CONSTRAINT departments_subcategory_id_fkey 
FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE SET NULL;

-- Department subcategory mapping table (for departments that handle multiple subcategories)
CREATE TABLE IF NOT EXISTS public.department_subcategory_mapping (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  department_id bigint NOT NULL,
  subcategory_id uuid NOT NULL,
  is_primary boolean DEFAULT false, -- primary department for this subcategory
  response_priority integer DEFAULT 1, -- 1 = highest priority
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT department_subcategory_mapping_pkey PRIMARY KEY (id),
  CONSTRAINT department_subcategory_mapping_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
  CONSTRAINT department_subcategory_mapping_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id) ON DELETE CASCADE,
  CONSTRAINT department_subcategory_mapping_unique UNIQUE (department_id, subcategory_id)
);

-- Insert categories
INSERT INTO public.categories (name, code, description, icon, sort_order) VALUES
('Infrastructure & Public Works', 'INFRA', 'Roads, construction, facilities, and public works', '🏗️', 1),
('Health & Social Services', 'HEALTH', 'Public health, social welfare, emergency response', '🧑‍⚕️', 2),
('Environment & Sanitation', 'ENV', 'Waste management, environmental regulation', '🌿', 3),
('Licensing, Permits & Business', 'LICENSE', 'Business regulation, transport licensing, taxes', '🪪', 4),
('Labor & Employment', 'LABOR', 'Labor issues, personnel management', '🧑‍💼', 5),
('Law Enforcement & Legal Affairs', 'LEGAL', 'Police, legal investigation, executive oversight', '🛡️', 6),
('Public Assistance & Communication', 'PUBLIC', 'Frontline assistance, complaint routing, information', '📨', 7),
('Finance & Revenue', 'FINANCE', 'Tax collection, financial review', '💰', 8)
ON CONFLICT (code) DO NOTHING;

-- Insert subcategories
INSERT INTO public.subcategories (category_id, name, code, description, sort_order) VALUES
-- Infrastructure & Public Works
((SELECT id FROM categories WHERE code = 'INFRA'), 'Roads & Construction', 'ROADS', 'Road maintenance, construction projects', 1),
((SELECT id FROM categories WHERE code = 'INFRA'), 'Facilities & Maintenance', 'FACILITIES', 'Public facilities, building maintenance', 2),
((SELECT id FROM categories WHERE code = 'INFRA'), 'Land Use & Planning', 'PLANNING', 'Urban planning, land use regulation', 3),

-- Health & Social Services
((SELECT id FROM categories WHERE code = 'HEALTH'), 'Public Health', 'PUBLIC_HEALTH', 'Health services, disease prevention', 1),
((SELECT id FROM categories WHERE code = 'HEALTH'), 'Social Welfare', 'SOCIAL_WELFARE', 'Social services, welfare programs', 2),
((SELECT id FROM categories WHERE code = 'HEALTH'), 'Emergency Response', 'EMERGENCY', 'Disaster response, emergency services', 3),
((SELECT id FROM categories WHERE code = 'HEALTH'), 'Education Welfare', 'EDUCATION', 'Educational support, school services', 4),

-- Environment & Sanitation
((SELECT id FROM categories WHERE code = 'ENV'), 'Waste Management', 'WASTE', 'Garbage collection, waste disposal', 1),
((SELECT id FROM categories WHERE code = 'ENV'), 'Environmental Regulation', 'ENV_REG', 'Environmental compliance, regulation', 2),

-- Licensing, Permits & Business
((SELECT id FROM categories WHERE code = 'LICENSE'), 'Business Regulation', 'BUSINESS', 'Business permits, trade regulation', 1),
((SELECT id FROM categories WHERE code = 'LICENSE'), 'Transport & Licensing', 'TRANSPORT', 'Vehicle registration, transport permits', 2),
((SELECT id FROM categories WHERE code = 'LICENSE'), 'Tax & Fees', 'TAX', 'Tax collection, fee management', 3),
((SELECT id FROM categories WHERE code = 'LICENSE'), 'Economic Enterprises', 'ECONOMIC', 'Economic development, enterprise support', 4),

-- Labor & Employment
((SELECT id FROM categories WHERE code = 'LABOR'), 'Labor Issues', 'LABOR_ISSUES', 'Labor disputes, employment issues', 1),
((SELECT id FROM categories WHERE code = 'LABOR'), 'Personnel & Staff', 'PERSONNEL', 'HR management, staff services', 2),

-- Law Enforcement & Legal Affairs
((SELECT id FROM categories WHERE code = 'LEGAL'), 'Police & Security', 'POLICE', 'Law enforcement, public safety', 1),
((SELECT id FROM categories WHERE code = 'LEGAL'), 'Legal Investigation', 'LEGAL_INV', 'Legal proceedings, investigations', 2),
((SELECT id FROM categories WHERE code = 'LEGAL'), 'Executive Oversight', 'EXECUTIVE', 'Mayor office, executive decisions', 3),

-- Public Assistance & Communication
((SELECT id FROM categories WHERE code = 'PUBLIC'), 'Frontline Assistance', 'FRONTLINE', 'Public assistance desk, customer service', 1),
((SELECT id FROM categories WHERE code = 'PUBLIC'), 'Complaint Routing', 'ROUTING', 'Complaint management, routing', 2),
((SELECT id FROM categories WHERE code = 'PUBLIC'), 'Information & Feedback', 'INFO', 'Public information, feedback collection', 3),

-- Finance & Revenue
((SELECT id FROM categories WHERE code = 'FINANCE'), 'Tax Collection', 'TAX_COLLECTION', 'Tax collection, revenue generation', 1),
((SELECT id FROM categories WHERE code = 'FINANCE'), 'Financial Review', 'FINANCIAL_REVIEW', 'Financial auditing, budget review', 2)
ON CONFLICT (category_id, code) DO NOTHING;

-- Update existing departments with subcategory relationships
UPDATE public.departments SET 
  subcategory_id = (SELECT id FROM subcategories WHERE code = 'ROADS'),
  level = 'LGU',
  response_time_hours = 24,
  escalation_time_hours = 72
WHERE code = 'CEO';

UPDATE public.departments SET 
  subcategory_id = (SELECT id FROM subcategories WHERE code = 'FACILITIES'),
  level = 'LGU',
  response_time_hours = 48,
  escalation_time_hours = 96
WHERE code = 'GSO';

UPDATE public.departments SET 
  subcategory_id = (SELECT id FROM subcategories WHERE code = 'PLANNING'),
  level = 'LGU',
  response_time_hours = 72,
  escalation_time_hours = 144
WHERE code = 'CPDC';

-- Insert remaining departments
INSERT INTO public.departments (name, code, description, subcategory_id, level, response_time_hours, escalation_time_hours) VALUES
-- Health & Social Services
('Digos City Health Office', 'CHO', 'Public health services and disease prevention', 
 (SELECT id FROM subcategories WHERE code = 'PUBLIC_HEALTH'), 'LGU', 12, 24),
('City Social Welfare and Development Office', 'CSWDO', 'Social welfare programs and services', 
 (SELECT id FROM subcategories WHERE code = 'SOCIAL_WELFARE'), 'LGU', 24, 48),
('City Disaster Risk Reduction and Management Office', 'CDRRMO', 'Emergency response and disaster management', 
 (SELECT id FROM subcategories WHERE code = 'EMERGENCY'), 'LGU', 2, 6),
('Department of Education – Digos City Division', 'DEPED', 'Educational services and support', 
 (SELECT id FROM subcategories WHERE code = 'EDUCATION'), 'NGA', 48, 96),

-- Environment & Sanitation
('City ENRO', 'ENRO', 'Environmental and natural resources office', 
 (SELECT id FROM subcategories WHERE code = 'WASTE'), 'LGU', 24, 48),
('DENR – CENRO Digos', 'DENR', 'Environmental regulation and compliance', 
 (SELECT id FROM subcategories WHERE code = 'ENV_REG'), 'NGA', 48, 96),

-- Licensing, Permits & Business
('Department of Trade and Industry – Digos', 'DTI', 'Business regulation and trade services', 
 (SELECT id FROM subcategories WHERE code = 'BUSINESS'), 'NGA', 24, 48),
('Land Transportation Office – Digos', 'LTO', 'Vehicle registration and transport licensing', 
 (SELECT id FROM subcategories WHERE code = 'TRANSPORT'), 'NGA', 12, 24),
('City Treasurer''s Office', 'CTO', 'Tax collection and revenue management', 
 (SELECT id FROM subcategories WHERE code = 'TAX'), 'LGU', 24, 48),
('City Economic Enterprise Office', 'CEEO', 'Economic development and enterprise support', 
 (SELECT id FROM subcategories WHERE code = 'ECONOMIC'), 'LGU', 48, 96),

-- Labor & Employment
('Department of Labor and Employment – Digos', 'DOLE', 'Labor regulation and employment services', 
 (SELECT id FROM subcategories WHERE code = 'LABOR_ISSUES'), 'NGA', 24, 48),
('Human Resource Management Office', 'HRMO', 'Personnel management and HR services', 
 (SELECT id FROM subcategories WHERE code = 'PERSONNEL'), 'LGU', 48, 96),

-- Law Enforcement & Legal Affairs
('Philippine National Police – Digos City Station', 'PNP', 'Law enforcement and public safety', 
 (SELECT id FROM subcategories WHERE code = 'POLICE'), 'NGA', 2, 6),
('City Legal Office', 'CLO', 'Legal services and investigation', 
 (SELECT id FROM subcategories WHERE code = 'LEGAL_INV'), 'LGU', 24, 48),
('Office of the City Mayor', 'OCM', 'Executive oversight and decision making', 
 (SELECT id FROM subcategories WHERE code = 'EXECUTIVE'), 'LGU', 48, 96),

-- Public Assistance & Communication
('Public Assistance Desk', 'PAD', 'Frontline public assistance and customer service', 
 (SELECT id FROM subcategories WHERE code = 'FRONTLINE'), 'LGU', 2, 6),
('Office of the City Administrator', 'OCA', 'Complaint routing and administrative oversight', 
 (SELECT id FROM subcategories WHERE code = 'ROUTING'), 'LGU', 12, 24),
('City Information Office', 'CIO', 'Public information and feedback collection', 
 (SELECT id FROM subcategories WHERE code = 'INFO'), 'LGU', 24, 48),

-- Finance & Revenue
('City Accountant''s Office', 'CAO', 'Financial auditing and budget review', 
 (SELECT id FROM subcategories WHERE code = 'FINANCIAL_REVIEW'), 'LGU', 48, 96)
ON CONFLICT (code) DO NOTHING;

-- Create department-subcategory mappings for departments that handle multiple subcategories
INSERT INTO public.department_subcategory_mapping (department_id, subcategory_id, is_primary, response_priority) VALUES
-- City Treasurer's Office handles both tax collection and financial review
((SELECT id FROM departments WHERE code = 'CTO'), (SELECT id FROM subcategories WHERE code = 'TAX'), true, 1),
((SELECT id FROM departments WHERE code = 'CTO'), (SELECT id FROM subcategories WHERE code = 'FINANCIAL_REVIEW'), false, 2),

-- Office of the City Administrator handles both routing and executive oversight
((SELECT id FROM departments WHERE code = 'OCA'), (SELECT id FROM subcategories WHERE code = 'ROUTING'), true, 1),
((SELECT id FROM departments WHERE code = 'OCA'), (SELECT id FROM subcategories WHERE code = 'EXECUTIVE'), false, 2)
ON CONFLICT (department_id, subcategory_id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON public.subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_departments_subcategory_id ON public.departments(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_department_subcategory_mapping_department_id ON public.department_subcategory_mapping(department_id);
CREATE INDEX IF NOT EXISTS idx_department_subcategory_mapping_subcategory_id ON public.department_subcategory_mapping(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_departments_level ON public.departments(level);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON public.departments(is_active);
