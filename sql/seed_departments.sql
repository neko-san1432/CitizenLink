-- ============================================================================
-- Seed Data: Departments
-- Common LGU departments with codes
-- ============================================================================

INSERT INTO public.departments (name, code) VALUES
-- WST - Water, Sanitation, and Treatment
('Water, Sanitation, and Treatment Department', 'wst'),

-- Engineering Department
('Engineering Department', 'engineering'),

-- Health Department
('Health Department', 'health'),

-- Social Welfare Department
('Social Welfare Department', 'social-welfare'),

-- Public Safety Department
('Public Safety Department', 'public-safety'),

-- Environmental Services
('Environmental Services Department', 'environmental'),

-- Transportation Department
('Transportation Department', 'transportation'),

-- Public Works Department
('Public Works Department', 'public-works')

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name;

-- Display confirmation
DO $$ 
BEGIN
  RAISE NOTICE '✅ Seeded % departments', (SELECT COUNT(*) FROM public.departments);
END $$;

