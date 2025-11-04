    -- Initial seed data for CitizenLink
    -- Safe to run multiple times due to ON CONFLICT clauses

    -- Categories (Complete structure from x.md)
    INSERT INTO public.categories (id, name, code, description)
    VALUES
    (gen_random_uuid(), 'Infrastructure & Public Works', 'INFRA', 'Roads, construction, facilities, and public works'),
    (gen_random_uuid(), 'Health & Social Services', 'HEALTH', 'Public health, social welfare, and emergency response'),
    (gen_random_uuid(), 'Environment & Sanitation', 'ENV', 'Waste management, pollution, and environmental protection'),
    (gen_random_uuid(), 'Licensing, Permits & Business', 'LICENSE', 'Tax collection, permits, and economic enterprises'),
    (gen_random_uuid(), 'Labor & Employment', 'LABOR', 'Personnel management and employment services'),
    (gen_random_uuid(), 'Law Enforcement & Legal Affairs', 'LEGAL', 'Police, security, legal investigation, and executive oversight'),
    (gen_random_uuid(), 'Public Assistance & Communication', 'ASSISTANCE', 'Frontline assistance, complaint routing, and information services'),
    (gen_random_uuid(), 'Finance & Revenue', 'FINANCE', 'Tax collection and financial review services')
    ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

    -- Subcategories (Complete structure from x.md)
    -- Check if records already exist before inserting
    WITH cat AS (
    SELECT id, code FROM public.categories
    )
    INSERT INTO public.subcategories (id, category_id, name, code, description)
    SELECT * FROM (VALUES
    -- Infrastructure & Public Works
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'INFRA'), 'Roads & Construction', 'ROADS_CONSTRUCTION', 'Road damage, potholes, construction issues'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'INFRA'), 'Facilities & Maintenance', 'FACILITIES_MAINTENANCE', 'Public building maintenance and facilities'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'INFRA'), 'Land Use & Planning', 'LAND_USE_PLANNING', 'Zoning, land use, and development planning'),
    
    -- Health & Social Services
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'HEALTH'), 'Public Health', 'PUBLIC_HEALTH', 'Health services, medical concerns, disease prevention'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'HEALTH'), 'Social Welfare', 'SOCIAL_WELFARE', 'Social services, welfare programs, community assistance'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'HEALTH'), 'Emergency Response', 'EMERGENCY_RESPONSE', 'Disaster response, emergency services, crisis management'),
    
    -- Environment & Sanitation
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'ENV'), 'Waste Management', 'WASTE_MANAGEMENT', 'Garbage collection, waste disposal, recycling'),
    
    -- Licensing, Permits & Business
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'LICENSE'), 'Tax & Fees', 'TAX_FEES', 'Tax collection, fee payment, revenue services'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'LICENSE'), 'Economic Enterprises', 'ECONOMIC_ENTERPRISES', 'Business permits, economic development, enterprise services'),
    
    -- Labor & Employment
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'LABOR'), 'Personnel & Staff', 'PERSONNEL_STAFF', 'HR services, personnel management, employment issues'),
    
    -- Law Enforcement & Legal Affairs
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'LEGAL'), 'Police & Security', 'POLICE_SECURITY', 'Crime reports, security concerns, law enforcement'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'LEGAL'), 'Legal Investigation', 'LEGAL_INVESTIGATION', 'Legal matters, investigations, court proceedings'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'LEGAL'), 'Executive Oversight', 'EXECUTIVE_OVERSIGHT', 'Mayor\'s office, executive decisions, administrative oversight'),
    
    -- Public Assistance & Communication
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'ASSISTANCE'), 'Frontline Assistance', 'FRONTLINE_ASSISTANCE', 'Public assistance desk, citizen services'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'ASSISTANCE'), 'Complaint Routing', 'COMPLAINT_ROUTING', 'Complaint processing, routing, and follow-up'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'ASSISTANCE'), 'Information & Feedback', 'INFORMATION_FEEDBACK', 'Public information, feedback, communication services'),
    
    -- Finance & Revenue
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'FINANCE'), 'Tax Collection', 'TAX_COLLECTION', 'Tax collection, revenue generation, financial services'),
    (gen_random_uuid(), (SELECT id FROM cat WHERE code = 'FINANCE'), 'Financial Review', 'FINANCIAL_REVIEW', 'Financial auditing, budget review, accounting services')
    ) AS v(id, category_id, name, code, description)
    WHERE NOT EXISTS (
    SELECT 1 FROM public.subcategories 
    WHERE code = v.code
    );

    -- Departments (using bigint ID, not uuid) - Complete Digos City Office List from x.md
    INSERT INTO public.departments (name, code, description, level, contact_info, response_time_hours, escalation_time_hours)
    VALUES
    -- Infrastructure & Public Works
    ('City Engineering Office', 'CEO', 'Roads, construction, and infrastructure maintenance', 'LGU', '{"email":"ceo@digoscity.gov.ph","phone":"(082) 553-1234"}', 24, 72),
    ('City General Services Office', 'GSO', 'Facilities and maintenance services', 'LGU', '{"email":"gso@digoscity.gov.ph","phone":"(082) 553-1235"}', 48, 96),
    ('City Planning and Development Coordinator', 'CPDC', 'Land use planning and development coordination', 'LGU', '{"email":"cpdc@digoscity.gov.ph","phone":"(082) 553-1236"}', 72, 120),
    
    -- Health & Social Services
    ('Digos City Health Office', 'CHO', 'Public health and medical services', 'LGU', '{"email":"cho@digoscity.gov.ph","phone":"(082) 553-1237"}', 12, 24),
    ('City Social Welfare and Development Office', 'CSWDO', 'Social welfare and community development', 'LGU', '{"email":"cswdo@digoscity.gov.ph","phone":"(082) 553-1238"}', 24, 48),
    ('City Disaster Risk Reduction and Management Office', 'CDRRMO', 'Emergency response and disaster management', 'LGU', '{"email":"cdrrmo@digoscity.gov.ph","phone":"(082) 553-1239"}', 6, 12),
    
    -- Environment & Sanitation
    ('City Environment and Natural Resources Office', 'ENRO', 'Environmental protection and natural resources management', 'LGU', '{"email":"enro@digoscity.gov.ph","phone":"(082) 553-1240"}', 24, 48),
    
    -- Licensing, Permits & Business
    ('City Treasurer''s Office', 'CTO', 'Tax collection and revenue management', 'LGU', '{"email":"cto@digoscity.gov.ph","phone":"(082) 553-1241"}', 24, 48),
    ('City Economic Enterprise Office', 'CEEO', 'Economic development and enterprise support', 'LGU', '{"email":"ceeo@digoscity.gov.ph","phone":"(082) 553-1242"}', 48, 96),
    
    -- Labor & Employment
    ('Human Resource Management Office', 'HRMO', 'Personnel management and staff services', 'LGU', '{"email":"hrmo@digoscity.gov.ph","phone":"(082) 553-1243"}', 24, 48),
    
    -- Law Enforcement & Legal Affairs
    ('Philippine National Police - Digos City Station', 'PNP', 'Police services and law enforcement', 'NGA', '{"email":"pnp.digos@philnationalpolice.gov.ph","phone":"(082) 553-1244"}', 2, 6),
    ('City Legal Office', 'CLO', 'Legal services and investigation', 'LGU', '{"email":"clo@digoscity.gov.ph","phone":"(082) 553-1245"}', 48, 96),
    ('Office of the City Mayor', 'OCM', 'Executive oversight and city administration', 'LGU', '{"email":"mayor@digoscity.gov.ph","phone":"(082) 553-1246"}', 72, 120),
    
    -- Public Assistance & Communication
    ('Public Assistance Desk', 'PAD', 'Frontline citizen assistance and support', 'LGU', '{"email":"pad@digoscity.gov.ph","phone":"(082) 553-1247"}', 4, 8),
    ('Office of the City Administrator', 'OCA', 'Complaint routing and administrative coordination', 'LGU', '{"email":"oca@digoscity.gov.ph","phone":"(082) 553-1248"}', 24, 48),
    ('City Information Office', 'CIO', 'Public information and communication', 'LGU', '{"email":"cio@digoscity.gov.ph","phone":"(082) 553-1249"}', 24, 48),
    
    -- Finance & Revenue
    ('City Accountant''s Office', 'CAO', 'Financial review and accounting services', 'LGU', '{"email":"cao@digoscity.gov.ph","phone":"(082) 553-1250"}', 48, 96),
    
    -- Additional NGA Departments (Missing from original seed)
    ('Department of Education – Digos City Division', 'DEPED', 'Educational services and support', 'NGA', '{"email":"deped.digos@deped.gov.ph","phone":"(082) 553-1251"}', 48, 96),
    ('DENR – CENRO Digos', 'DENR', 'Environmental regulation and compliance', 'NGA', '{"email":"cenro.digos@denr.gov.ph","phone":"(082) 553-1252"}', 48, 96),
    ('Department of Trade and Industry – Digos', 'DTI', 'Business regulation and trade services', 'NGA', '{"email":"dti.digos@dti.gov.ph","phone":"(082) 553-1253"}', 24, 48),
    ('Land Transportation Office – Digos', 'LTO', 'Vehicle registration and transport licensing', 'NGA', '{"email":"lto.digos@lto.gov.ph","phone":"(082) 553-1254"}', 12, 24),
    ('Department of Labor and Employment – Digos', 'DOLE', 'Labor regulation and employment services', 'NGA', '{"email":"dole.digos@dole.gov.ph","phone":"(082) 553-1255"}', 24, 48)
    ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    level = EXCLUDED.level,
    contact_info = EXCLUDED.contact_info,
    response_time_hours = EXCLUDED.response_time_hours,
    escalation_time_hours = EXCLUDED.escalation_time_hours;

    -- Department escalation matrix (basic routing rules) - Updated with office codes
    -- Check if records already exist before inserting
    INSERT INTO public.department_escalation_matrix (
    complaint_type, keywords, primary_department, secondary_departments, auto_assign, priority_boost, response_deadline_hours, is_active
    )
    SELECT * FROM (VALUES
    ('Infrastructure', ARRAY['road','pothole','asphalt','streetlight','lamp','drain','construction','bridge'], 'CEO', ARRAY['GSO','CDRRMO'], true, 1, 24, true),
    ('Health', ARRAY['sanitation','dengue','mosquito','trash','garbage','sewage','health','medical','clinic'], 'CHO', ARRAY['ENRO','CSWDO'], true, 1, 12, true),
    ('Environment', ARRAY['pollution','smoke','illegal dump','waste','chemicals','environment','air quality','water'], 'ENRO', ARRAY['CHO','CDRRMO'], false, 0, 24, true),
    ('Public Safety', ARRAY['traffic','obstruction','accident','crowd','noise','emergency','disaster','flood'], 'CDRRMO', ARRAY['CEO','PNP'], true, 1, 6, true),
    ('Social Welfare', ARRAY['social','welfare','poverty','elderly','children','disability','assistance'], 'CSWDO', ARRAY['CHO','PAD'], true, 1, 24, true),
    ('Legal Affairs', ARRAY['legal','court','violation','ordinance','complaint','investigation'], 'CLO', ARRAY['OCM','OCA'], false, 0, 48, true),
    ('Economic', ARRAY['business','permit','license','tax','revenue','economic','enterprise'], 'CTO', ARRAY['CEEO','CAO'], true, 1, 24, true)
    ) AS v(complaint_type, keywords, primary_department, secondary_departments, auto_assign, priority_boost, response_deadline_hours, is_active)
    WHERE NOT EXISTS (
    SELECT 1 FROM public.department_escalation_matrix 
    WHERE complaint_type = v.complaint_type 
    AND primary_department = v.primary_department
    );

    -- Settings
    INSERT INTO public.settings (key, value, type, category, description)
    VALUES
    ('app.brandName', 'CitizenLink', 'text', 'general', 'Application display name'),
    ('notifications.enabled', 'true', 'boolean', 'notifications', 'Enable in-app notifications'),
    ('notifications.realtime', 'true', 'boolean', 'notifications', 'Enable SSE real-time notifications'),
    ('reminders.enabled', 'true', 'boolean', 'reminders', 'Enable automatic reminders for stale complaints'),
    ('reminders.intervalHours', '24', 'number', 'reminders', 'Minimum hours between reminders for same complaint'),
    ('complaints.defaultPriority', 'low', 'text', 'complaints', 'Default priority for new complaints')
    ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    type = EXCLUDED.type,
    category = EXCLUDED.category,
    description = EXCLUDED.description;

    -- Department-Subcategory Mappings (Complete structure from x.md)
    -- Map departments to relevant subcategories
    WITH dept AS (
        SELECT id, code FROM public.departments
    ),
    sub AS (
        SELECT id, code FROM public.subcategories
    )
    INSERT INTO public.department_subcategory_mapping (department_id, subcategory_id, response_priority)
    SELECT * FROM (VALUES
    -- Infrastructure & Public Works
    ((SELECT id FROM dept WHERE code = 'CEO'), (SELECT id FROM sub WHERE code = 'ROADS_CONSTRUCTION'), 1),
    ((SELECT id FROM dept WHERE code = 'CEO'), (SELECT id FROM sub WHERE code = 'FACILITIES_MAINTENANCE'), 2),
    ((SELECT id FROM dept WHERE code = 'GSO'), (SELECT id FROM sub WHERE code = 'FACILITIES_MAINTENANCE'), 1),
    ((SELECT id FROM dept WHERE code = 'CPDC'), (SELECT id FROM sub WHERE code = 'LAND_USE_PLANNING'), 1),
    
    -- Health & Social Services
    ((SELECT id FROM dept WHERE code = 'CHO'), (SELECT id FROM sub WHERE code = 'PUBLIC_HEALTH'), 1),
    ((SELECT id FROM dept WHERE code = 'CSWDO'), (SELECT id FROM sub WHERE code = 'SOCIAL_WELFARE'), 1),
    ((SELECT id FROM dept WHERE code = 'CDRRMO'), (SELECT id FROM sub WHERE code = 'EMERGENCY_RESPONSE'), 1),
    
    -- Environment & Sanitation
    ((SELECT id FROM dept WHERE code = 'ENRO'), (SELECT id FROM sub WHERE code = 'WASTE_MANAGEMENT'), 1),
    
    -- Licensing, Permits & Business
    ((SELECT id FROM dept WHERE code = 'CTO'), (SELECT id FROM sub WHERE code = 'TAX_FEES'), 1),
    ((SELECT id FROM dept WHERE code = 'CEEO'), (SELECT id FROM sub WHERE code = 'ECONOMIC_ENTERPRISES'), 1),
    
    -- Labor & Employment
    ((SELECT id FROM dept WHERE code = 'HRMO'), (SELECT id FROM sub WHERE code = 'PERSONNEL_STAFF'), 1),
    
    -- Law Enforcement & Legal Affairs
    ((SELECT id FROM dept WHERE code = 'PNP'), (SELECT id FROM sub WHERE code = 'POLICE_SECURITY'), 1),
    ((SELECT id FROM dept WHERE code = 'CLO'), (SELECT id FROM sub WHERE code = 'LEGAL_INVESTIGATION'), 1),
    ((SELECT id FROM dept WHERE code = 'OCM'), (SELECT id FROM sub WHERE code = 'EXECUTIVE_OVERSIGHT'), 1),
    
    -- Public Assistance & Communication
    ((SELECT id FROM dept WHERE code = 'PAD'), (SELECT id FROM sub WHERE code = 'FRONTLINE_ASSISTANCE'), 1),
    ((SELECT id FROM dept WHERE code = 'OCA'), (SELECT id FROM sub WHERE code = 'COMPLAINT_ROUTING'), 1),
    ((SELECT id FROM dept WHERE code = 'CIO'), (SELECT id FROM sub WHERE code = 'INFORMATION_FEEDBACK'), 1),
    
    -- Finance & Revenue
    ((SELECT id FROM dept WHERE code = 'CTO'), (SELECT id FROM sub WHERE code = 'TAX_COLLECTION'), 1),
    ((SELECT id FROM dept WHERE code = 'CAO'), (SELECT id FROM sub WHERE code = 'FINANCIAL_REVIEW'), 1)
    ) AS v(department_id, subcategory_id, response_priority)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.department_subcategory_mapping 
        WHERE department_id = v.department_id 
        AND subcategory_id = v.subcategory_id
    );

    -- Optional indexes helpful for seeds above (safe if they already exist)
    CREATE INDEX IF NOT EXISTS idx_departments_code ON public.departments(code);
    CREATE INDEX IF NOT EXISTS idx_categories_code ON public.categories(code);
    CREATE INDEX IF NOT EXISTS idx_subcategories_code ON public.subcategories(code);
    CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings(key);

    -- End of seed
