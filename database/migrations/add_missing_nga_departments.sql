-- Migration: Add missing NGA departments to reach 22 total departments
-- This adds the 5 missing National Government Agency departments

-- Add missing NGA departments
INSERT INTO public.departments (name, code, description, level, contact_info, response_time_hours, escalation_time_hours, is_active) VALUES
-- Education
('Department of Education – Digos City Division', 'DEPED', 'Educational services and support', 'NGA', '{"email":"deped.digos@deped.gov.ph","phone":"(082) 553-1251"}', 48, 96, true),

-- Environment
('DENR – CENRO Digos', 'DENR', 'Environmental regulation and compliance', 'NGA', '{"email":"cenro.digos@denr.gov.ph","phone":"(082) 553-1252"}', 48, 96, true),

-- Business & Trade
('Department of Trade and Industry – Digos', 'DTI', 'Business regulation and trade services', 'NGA', '{"email":"dti.digos@dti.gov.ph","phone":"(082) 553-1253"}', 24, 48, true),

-- Transportation
('Land Transportation Office – Digos', 'LTO', 'Vehicle registration and transport licensing', 'NGA', '{"email":"lto.digos@lto.gov.ph","phone":"(082) 553-1254"}', 12, 24, true),

-- Labor
('Department of Labor and Employment – Digos', 'DOLE', 'Labor regulation and employment services', 'NGA', '{"email":"dole.digos@dole.gov.ph","phone":"(082) 553-1255"}', 24, 48, true)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  contact_info = EXCLUDED.contact_info,
  response_time_hours = EXCLUDED.response_time_hours,
  escalation_time_hours = EXCLUDED.escalation_time_hours,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Add comments for documentation
COMMENT ON TABLE public.departments IS 'Complete list of 22 departments: 16 LGU + 6 NGA departments for Digos City';

-- Verify the count
DO $$
DECLARE
    dept_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dept_count FROM public.departments WHERE is_active = true;
    
    IF dept_count = 22 THEN
        RAISE NOTICE 'SUCCESS: Total departments count is now 22 (16 LGU + 6 NGA)';
    ELSE
        RAISE WARNING 'WARNING: Expected 22 departments, found %', dept_count;
    END IF;
END $$;
