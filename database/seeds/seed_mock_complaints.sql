-- ============================================================================
-- MOCK COMPLAINTS SEED DATA
-- Generated from DRIMS_Simulated_System/data/complaints/mock_complaints.json
-- 
-- IMPORTANT: Replace 'PLACEHOLDER_USER_ID' with a real user UUID from auth.users
-- before running this script. You can find user IDs with:
--   SELECT id, email FROM auth.users WHERE raw_user_meta_data->>'role' = 'citizen';
-- ============================================================================

-- First, let's create a function to get a random citizen user ID
-- (Comment this out if you want to manually set the user ID)
DO $$
DECLARE
    citizen_id uuid;
BEGIN
    -- Try to get an existing citizen user, or use a placeholder
    SELECT id INTO citizen_id FROM auth.users LIMIT 1;
    
    IF citizen_id IS NULL THEN
        RAISE NOTICE 'No users found in auth.users. Please create a user first or update submitted_by manually.';
    ELSE
        RAISE NOTICE 'Using user ID: %', citizen_id;
    END IF;
END $$;

-- ============================================================================
-- INFRASTRUCTURE COMPLAINTS (Pothole)
-- ============================================================================

INSERT INTO public.complaints (
    id, submitted_by, descriptive_su, location_text, latitude, longitude,
    category, subcategory, department_r, workflow_status, priority, status,
    confirmation_status, confirmed_by_citizen, all_responders_confirmed,
    submitted_at, updated_at, last_activity_at
) VALUES
-- Complaint 1: Road is uneven
(
    'fa9fdb0c-6a7b-4af5-bd09-96e9320807fb',
    (SELECT id FROM auth.users LIMIT 1),
    'Road is uneven',
    'National Highway, Digos City, Davao del Sur',
    6.738727414108823,
    125.35620868206026,
    'Infrastructure',
    'Pothole',
    '{}',
    'new',
    'low',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:25:36.735Z',
    '2026-01-13T15:25:36.735Z',
    '2026-01-13T15:25:36.735Z'
),
-- Complaint 2: Road is uneven (nearby location)
(
    '44dafae2-64fb-4054-96fc-60d263242ff2',
    (SELECT id FROM auth.users LIMIT 1),
    'Road is uneven',
    'National Highway, Digos City, Davao del Sur',
    6.738735405146178,
    125.35582780838014,
    'Infrastructure',
    'Pothole',
    '{}',
    'new',
    'low',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:26:34.170Z',
    '2026-01-13T15:26:34.170Z',
    '2026-01-13T15:26:34.170Z'
),
-- Complaint 3: Road is uneven
(
    '6b0be791-e13c-4a28-86c3-a34c04145295',
    (SELECT id FROM auth.users LIMIT 1),
    'Road is uneven',
    'National Highway, Digos City, Davao del Sur',
    6.738706104675221,
    125.35658955574037,
    'Infrastructure',
    'Pothole',
    '{}',
    'new',
    'low',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:26:44.594Z',
    '2026-01-13T15:26:44.594Z',
    '2026-01-13T15:26:44.594Z'
),
-- Complaint 4: Malubak yung daan (Tagalog: Road has potholes)
(
    '22b1a503-3d60-4b03-b169-a3e8a2f24d63',
    (SELECT id FROM auth.users LIMIT 1),
    'Malubak yung daan',
    'National Highway, Digos City, Davao del Sur',
    6.7386874589200465,
    125.35689800977708,
    'Infrastructure',
    'Pothole',
    '{}',
    'new',
    'low',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:27:37.639Z',
    '2026-01-13T15:27:37.639Z',
    '2026-01-13T15:27:37.639Z'
),
-- Complaint 5: Maliit ang daanan (Narrow road)
(
    '57b0e5d5-43ff-48b2-b88d-b3829a2bdbcd',
    (SELECT id FROM auth.users LIMIT 1),
    'Maliit ang daanan',
    'National Highway, Digos City, Davao del Sur',
    6.7386874589200465,
    125.35715550184251,
    'Infrastructure',
    'Pothole',
    '{}',
    'new',
    'low',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:27:59.283Z',
    '2026-01-13T15:27:59.283Z',
    '2026-01-13T15:27:59.283Z'
),
-- Complaint 6: May butas ang daan (Road has holes)
(
    'c1976497-92f2-450f-9b43-a7cc944fbe2d',
    (SELECT id FROM auth.users LIMIT 1),
    'May butas ang daan',
    'National Highway, Digos City, Davao del Sur',
    6.738642176368792,
    125.35761147737506,
    'Infrastructure',
    'Pothole',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:28:48.506Z',
    '2026-01-13T15:28:48.506Z',
    '2026-01-13T15:28:48.506Z'
);

-- ============================================================================
-- UTILITIES COMPLAINTS (Water)
-- ============================================================================

INSERT INTO public.complaints (
    id, submitted_by, descriptive_su, location_text, latitude, longitude,
    category, subcategory, department_r, workflow_status, priority, status,
    confirmation_status, confirmed_by_citizen, all_responders_confirmed,
    submitted_at, updated_at, last_activity_at
) VALUES
-- Complaint 7: Once a week lang nagkaka tubig dito
(
    'a5784db0-3505-40b3-abad-55f3b15571a7',
    (SELECT id FROM auth.users LIMIT 1),
    'Once a week lang nagkaka tubig dito',
    'Barangay Tres, Digos City, Davao del Sur',
    6.756728223327914,
    125.3584134578705,
    'Utilities',
    'No Water',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:29:47.780Z',
    '2026-01-13T15:29:47.780Z',
    '2026-01-13T15:29:47.780Z'
),
-- Complaint 8: Sa gabi lang may tubig
(
    'ddd2e792-9ca8-44e0-8f84-1226386454c5',
    (SELECT id FROM auth.users LIMIT 1),
    'Sa gabi lang may tubig',
    'Barangay Tres, Digos City, Davao del Sur',
    6.756254105832648,
    125.35950779914857,
    'Utilities',
    'No Water',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:30:22.880Z',
    '2026-01-13T15:30:22.880Z',
    '2026-01-13T15:30:22.880Z'
),
-- Complaint 9: Sometimes the water is unavailable
(
    '775d5c26-a232-44a7-83ba-f9ed59bee954',
    (SELECT id FROM auth.users LIMIT 1),
    'Sometimes the water is unavailable',
    'Barangay Tres, Digos City, Davao del Sur',
    6.756126253844241,
    125.35879969596864,
    'Utilities',
    'No Water',
    '{}',
    'new',
    'low',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:30:44.282Z',
    '2026-01-13T15:30:44.282Z',
    '2026-01-13T15:30:44.282Z'
),
-- Complaint 10: Mahina yung tubig sa umaga
(
    '1ef357da-ec48-4cf8-8744-6218f8858e4b',
    (SELECT id FROM auth.users LIMIT 1),
    'Mahina yung tubig sa umaga',
    'Barangay Tres, Digos City, Davao del Sur',
    6.756914673900962,
    125.35898208618165,
    'Utilities',
    'No Water',
    '{}',
    'new',
    'low',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:31:09.656Z',
    '2026-01-13T15:31:09.656Z',
    '2026-01-13T15:31:09.656Z'
),
-- Complaint 11: Palaging nawawala yung tubig sa afternoon
(
    '8aee13a8-bddc-4293-922f-5098aeefe551',
    (SELECT id FROM auth.users LIMIT 1),
    'Palaging nawawala yung tubig sa afternoon',
    'Barangay Tres, Digos City, Davao del Sur',
    6.755646808586727,
    125.35905182361604,
    'Utilities',
    'No Water',
    '{}',
    'new',
    'high',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:31:41.418Z',
    '2026-01-13T15:31:41.418Z',
    '2026-01-13T15:31:41.418Z'
);

-- ============================================================================
-- SANITATION COMPLAINTS
-- ============================================================================

INSERT INTO public.complaints (
    id, submitted_by, descriptive_su, location_text, latitude, longitude,
    category, subcategory, department_r, workflow_status, priority, status,
    confirmation_status, confirmed_by_citizen, all_responders_confirmed,
    submitted_at, updated_at, last_activity_at
) VALUES
-- Complaint 12: Very Smelly (Bad Odor)
(
    '6f124f6c-4d97-42c6-8ccc-16042792e88d',
    (SELECT id FROM auth.users LIMIT 1),
    'Very Smelly',
    'Rizal Avenue, Digos City, Davao del Sur',
    6.748785362182972,
    125.3574585914612,
    'Sanitation',
    'Bad Odor',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:32:34.696Z',
    '2026-01-13T15:32:34.696Z',
    '2026-01-13T15:32:34.696Z'
),
-- Complaint 13: Trashcans have lots of flies flying (Pest Infestation)
(
    'f672ae6f-d5d6-45fa-a146-cfed800df98a',
    (SELECT id FROM auth.users LIMIT 1),
    'Trashcans have lots of flies flying',
    'Rizal Avenue, Digos City, Davao del Sur',
    6.7485429723519115,
    125.35555422306062,
    'Sanitation',
    'Pest Infestation',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:33:17.408Z',
    '2026-01-13T15:33:17.408Z',
    '2026-01-13T15:33:17.408Z'
),
-- Complaint 14: I smell rotten fish and meat all the time
(
    'cf80f2d6-ea0a-413e-b22e-0b21cf4e6fbc',
    (SELECT id FROM auth.users LIMIT 1),
    'I smell rotten fish and meat all the time',
    'Rizal Avenue, Digos City, Davao del Sur',
    6.749248832511094,
    125.35689264535907,
    'Sanitation',
    'Bad Odor',
    '{}',
    'new',
    'high',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:33:54.380Z',
    '2026-01-13T15:33:54.380Z',
    '2026-01-13T15:33:54.380Z'
),
-- Complaint 15: No proper garbage disposal
(
    '4b0e04d1-fc86-44c2-bdd9-498cd7e674cf',
    (SELECT id FROM auth.users LIMIT 1),
    'No proper garbage disposal',
    'Rizal Avenue, Digos City, Davao del Sur',
    6.747421584851036,
    125.35737276077272,
    'Sanitation',
    'Garbage Collection',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:34:16.802Z',
    '2026-01-13T15:34:16.802Z',
    '2026-01-13T15:34:16.802Z'
);

-- ============================================================================
-- ENVIRONMENT COMPLAINTS (Flood)
-- ============================================================================

INSERT INTO public.complaints (
    id, submitted_by, descriptive_su, location_text, latitude, longitude,
    category, subcategory, department_r, workflow_status, priority, status,
    confirmation_status, confirmed_by_citizen, all_responders_confirmed,
    submitted_at, updated_at, last_activity_at
) VALUES
-- Complaint 16: Bumabaha dito pag ulan (Floods when it rains)
(
    'a2d3d4ac-ad48-4f3a-bcc7-44e582d6b18e',
    (SELECT id FROM auth.users LIMIT 1),
    'Bumabaha dito pag ulan',
    'Quezon Street, Digos City, Davao del Sur',
    6.75811594658362,
    125.3506511449814,
    'Environment',
    'Flood',
    '{}',
    'new',
    'high',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:35:00.716Z',
    '2026-01-13T15:35:00.716Z',
    '2026-01-13T15:35:00.716Z'
),
-- Complaint 17: Bumabaha dito pag ulan (nearby)
(
    '169934a3-48c3-4d9f-aed1-af06f8d5efea',
    (SELECT id FROM auth.users LIMIT 1),
    'Bumabaha dito pag ulan',
    'Quezon Street, Digos City, Davao del Sur',
    6.7572343032875075,
    125.35001814365388,
    'Environment',
    'Flood',
    '{}',
    'new',
    'high',
    'pending',
    'pending',
    false,
    false,
    '2026-01-13T15:35:30.000Z',
    '2026-01-13T15:35:30.000Z',
    '2026-01-13T15:35:30.000Z'
);

-- ============================================================================
-- ADDITIONAL DIVERSE COMPLAINTS (Traffic, Public Safety, Environment)
-- ============================================================================

INSERT INTO public.complaints (
    id, submitted_by, descriptive_su, location_text, latitude, longitude,
    category, subcategory, department_r, workflow_status, priority, status,
    confirmation_status, confirmed_by_citizen, all_responders_confirmed,
    submitted_at, updated_at, last_activity_at
) VALUES
-- Complaint 18: Traffic congestion at school zone
(
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'Sobrang traffic sa school zone lalo na pag dismissal',
    'Near Central Elementary School, Digos City, Davao del Sur',
    6.7495,
    125.3545,
    'Traffic',
    'Congestion',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-14T08:30:00.000Z',
    '2026-01-14T08:30:00.000Z',
    '2026-01-14T08:30:00.000Z'
),
-- Complaint 19: Broken traffic light
(
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'Sira ang traffic light sa intersection',
    'Main Intersection, Digos City, Davao del Sur',
    6.7502,
    125.3560,
    'Traffic',
    'Signal Malfunction',
    '{}',
    'new',
    'urgent',
    'pending',
    'pending',
    false,
    false,
    '2026-01-14T09:15:00.000Z',
    '2026-01-14T09:15:00.000Z',
    '2026-01-14T09:15:00.000Z'
),
-- Complaint 20: Stray dogs roaming
(
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'Maraming stray dogs sa area, delikado sa mga bata',
    'Barangay Zone 1, Digos City, Davao del Sur',
    6.7480,
    125.3570,
    'Public Safety',
    'Stray Animals',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-14T10:00:00.000Z',
    '2026-01-14T10:00:00.000Z',
    '2026-01-14T10:00:00.000Z'
),
-- Complaint 21: Dark street (no streetlight)
(
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'Walang ilaw sa daan, very dark at night',
    'Barangay Zone 2, Digos City, Davao del Sur',
    6.7465,
    125.3555,
    'Utilities',
    'Streetlight',
    '{}',
    'new',
    'high',
    'pending',
    'pending',
    false,
    false,
    '2026-01-14T18:45:00.000Z',
    '2026-01-14T18:45:00.000Z',
    '2026-01-14T18:45:00.000Z'
),
-- Complaint 22: Power outage
(
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'Brownout na naman, 3rd time this week',
    'Barangay Zone 3, Digos City, Davao del Sur',
    6.7510,
    125.3580,
    'Utilities',
    'Power Outage',
    '{}',
    'new',
    'urgent',
    'pending',
    'pending',
    false,
    false,
    '2026-01-14T14:20:00.000Z',
    '2026-01-14T14:20:00.000Z',
    '2026-01-14T14:20:00.000Z'
),
-- Complaint 23: Clogged drainage
(
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'Barado ang drainage kaya bumabaha',
    'Corner Street, Digos City, Davao del Sur',
    6.7475,
    125.3535,
    'Environment',
    'Clogged Drain',
    '{}',
    'new',
    'high',
    'pending',
    'pending',
    false,
    false,
    '2026-01-15T11:00:00.000Z',
    '2026-01-15T11:00:00.000Z',
    '2026-01-15T11:00:00.000Z'
),
-- Complaint 24: Illegal dumping
(
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'May nagtatapon ng basura sa vacant lot',
    'Vacant Lot, Barangay Zone 4, Digos City',
    6.7520,
    125.3590,
    'Environment',
    'Illegal Dumping',
    '{}',
    'new',
    'medium',
    'pending',
    'pending',
    false,
    false,
    '2026-01-15T07:30:00.000Z',
    '2026-01-15T07:30:00.000Z',
    '2026-01-15T07:30:00.000Z'
),
-- Complaint 25: Overgrown vegetation blocking road
(
    gen_random_uuid(),
    (SELECT id FROM auth.users LIMIT 1),
    'Harang na yung mga sanga ng puno sa kalsada',
    'Rural Road, Digos City, Davao del Sur',
    6.7400,
    125.3600,
    'Environment',
    'Overgrown Vegetation',
    '{}',
    'new',
    'low',
    'pending',
    'pending',
    false,
    false,
    '2026-01-15T09:45:00.000Z',
    '2026-01-15T09:45:00.000Z',
    '2026-01-15T09:45:00.000Z'
);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Total complaints inserted: 25
-- Categories covered:
--   - Infrastructure (6): Potholes
--   - Utilities (7): No Water, Streetlight, Power Outage
--   - Sanitation (4): Bad Odor, Pest Infestation, Garbage Collection
--   - Environment (5): Flood, Clogged Drain, Illegal Dumping, Overgrown Vegetation
--   - Traffic (2): Congestion, Signal Malfunction
--   - Public Safety (1): Stray Animals
-- ============================================================================

-- Verify the inserted data
SELECT 
    category, 
    COUNT(*) as count,
    string_agg(DISTINCT subcategory, ', ') as subcategories
FROM public.complaints 
WHERE submitted_at >= '2026-01-13'
GROUP BY category
ORDER BY count DESC;
