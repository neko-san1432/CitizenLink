-- ============================================================================
-- Create Digos City Cluster with Real User IDs
-- ============================================================================
-- This script generates sample complaints using actual user IDs and creates a cluster
-- 
-- Usage: Run this script in your PostgreSQL/Supabase database
-- 
-- EPS Value: 0.01 (degrees) ≈ 1.1 km
-- Clustering Radius: 0.5 km (500 meters)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create boundary validation function (if not exists)
-- ============================================================================

CREATE OR REPLACE FUNCTION is_within_digos_boundary(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
) RETURNS BOOLEAN AS $$
DECLARE
    min_lat DOUBLE PRECISION := 6.723539;
    max_lat DOUBLE PRECISION := 6.985025;
    min_lng DOUBLE PRECISION := 125.245633;
    max_lng DOUBLE PRECISION := 125.391290;
BEGIN
    IF lat < min_lat OR lat > max_lat OR lng < min_lng OR lng > max_lng THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Generate complaints and create cluster
-- ============================================================================

DO $$
DECLARE
    -- Valid user IDs from database
    user_ids UUID[] := ARRAY[
        '002a2354-193a-4984-b811-9c01406c92b3',
        '00e67150-7b3a-4687-b37c-b37b2d6584d8',
        '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c',
        '6fda128c-3438-47aa-a5a5-40462aa66971',
        '8e6aa537-86bb-4097-bbd6-b0789f877b9e',
        'a3ffc696-3a78-43b7-8893-df3db91e0d9b',
        'a84b1f04-a7ac-4151-ab86-cb80b1d955ba',
        'b120db0c-eb8b-4ea4-8d0e-09918f961816',
        'bf574708-5a85-4eaa-9b3a-5cadb3077e02',
        'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487',
        'cc1813e0-7df7-4529-941c-660dc3180a78',
        'eada69c6-24e6-479a-9e0f-10c82f49062e',
        'f006e634-3298-4247-9439-5b11580026b4'
    ]::UUID[];
    
    -- Cluster center coordinates (within Digos - central area)
    cluster_center_lat DOUBLE PRECISION := 6.7666;
    cluster_center_lng DOUBLE PRECISION := 125.2869;
    
    -- Complaint IDs for cluster
    complaint_ids UUID[] := ARRAY[]::UUID[];
    
    -- Temporary variables
    complaint_id UUID;
    user_id UUID;
    i INTEGER;
    angle DOUBLE PRECISION;
    distance DOUBLE PRECISION;
    lat_offset DOUBLE PRECISION;
    lng_offset DOUBLE PRECISION;
    complaint_lat DOUBLE PRECISION;
    complaint_lng DOUBLE PRECISION;
    
    -- Categories and priorities
    categories TEXT[] := ARRAY['Infrastructure', 'Sanitation', 'Traffic', 'Environment', 'Public Safety'];
    priorities TEXT[] := ARRAY['low', 'medium', 'high', 'urgent'];
    workflow_statuses TEXT[] := ARRAY['new', 'assigned', 'in_progress', 'pending_approval', 'completed'];
    
    -- Cluster variables
    avg_lat DOUBLE PRECISION;
    avg_lng DOUBLE PRECISION;
    max_radius DOUBLE PRECISION;
    radius_meters INTEGER;
    pattern_type TEXT;
    cluster_id UUID;
BEGIN
    RAISE NOTICE 'Starting cluster generation with % users', array_length(user_ids, 1);
    
    -- Generate complaints (one per user, distributed around cluster center)
    FOR i IN 1..array_length(user_ids, 1) LOOP
        -- Get user ID (cycle through if more complaints than users)
        user_id := user_ids[((i - 1) % array_length(user_ids, 1)) + 1];
        
        -- Generate random point within 0.5 km of cluster center
        angle := (i - 1) * (2 * PI() / array_length(user_ids, 1)); -- Distribute evenly around circle
        distance := (RANDOM() * 0.4 + 0.1)::DOUBLE PRECISION; -- 0.1 to 0.5 km
        
        -- Convert distance to lat/lng offset (approximate)
        lat_offset := distance / 111.0; -- ~111 km per degree latitude
        lng_offset := distance / (111.0 * COS(RADIANS(cluster_center_lat)));
        
        complaint_lat := cluster_center_lat + lat_offset * SIN(angle);
        complaint_lng := cluster_center_lng + lng_offset * COS(angle);
        
        -- Ensure coordinates are within Digos boundary
        IF NOT is_within_digos_boundary(complaint_lat, complaint_lng) THEN
            -- Use cluster center if generated point is outside
            complaint_lat := cluster_center_lat;
            complaint_lng := cluster_center_lng;
        END IF;
        
        -- Generate complaint ID
        complaint_id := gen_random_uuid();
        complaint_ids := array_append(complaint_ids, complaint_id);
        
        -- Insert complaint
        INSERT INTO public.complaints (
            id,
            submitted_by,
            title,
            descriptive_su,
            location_text,
            latitude,
            longitude,
            category,
            subcategory,
            department_r,
            preferred_departments,
            workflow_status,
            priority,
            status,
            submitted_at,
            updated_at,
            last_activity_at,
            confirmation_status,
            is_duplicate,
            all_responders_confirmed
        ) VALUES (
            complaint_id,
            user_id,
            'Sample Complaint ' || i || ' - ' || categories[((i - 1) % array_length(categories, 1)) + 1],
            'This is a sample complaint generated for testing cluster detection. Located in Digos City, Davao del Sur. Complaint #' || i,
            'Digos City, Davao del Sur',
            complaint_lat,
            complaint_lng,
            categories[((i - 1) % array_length(categories, 1)) + 1],
            'General',
            ARRAY['DPWH', 'ENRO']::TEXT[],
            '[]'::JSONB,
            workflow_statuses[((i - 1) % array_length(workflow_statuses, 1)) + 1],
            priorities[((i - 1) % array_length(priorities, 1)) + 1],
            'pending',
            NOW() - (RANDOM() * INTERVAL '7 days'), -- Random submission time within last week
            NOW(),
            NOW(),
            'pending',
            FALSE,
            FALSE
        );
        
        RAISE NOTICE 'Inserted complaint % for user %: (%, %)', 
            i, user_id, complaint_lat, complaint_lng;
    END LOOP;
    
    RAISE NOTICE 'Generated % complaints', array_length(complaint_ids, 1);
    
    -- ============================================================================
    -- STEP 3: Create cluster from the generated complaints
    -- ============================================================================
    
    -- Calculate cluster center (average of complaint coordinates)
    SELECT 
        AVG(latitude),
        AVG(longitude)
    INTO avg_lat, avg_lng
    FROM public.complaints
    WHERE id = ANY(complaint_ids);
    
    -- Calculate maximum radius from center (in meters)
    SELECT 
        MAX(
            111.0 * 1000 * SQRT(
                POWER((latitude - avg_lat) * PI() / 180, 2) +
                POWER((longitude - avg_lng) * PI() / 180 * COS(RADIANS(avg_lat)), 2)
            )
        )
    INTO max_radius
    FROM public.complaints
    WHERE id = ANY(complaint_ids);
    
    radius_meters := CEIL(max_radius);
    
    -- Determine pattern type based on complaint count
    IF array_length(complaint_ids, 1) >= 10 THEN
        pattern_type := 'outbreak';
    ELSIF array_length(complaint_ids, 1) >= 5 THEN
        pattern_type := 'recurring';
    ELSE
        pattern_type := 'normal';
    END IF;
    
    -- Generate cluster ID
    cluster_id := gen_random_uuid();
    
    -- Insert cluster
    INSERT INTO public.complaint_clusters (
        id,
        cluster_name,
        center_lat,
        center_lng,
        radius_meters,
        complaint_ids,
        pattern_type,
        status,
        identified_at,
        created_at,
        updated_at
    ) VALUES (
        cluster_id,
        'Digos City Cluster - ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI'),
        avg_lat,
        avg_lng,
        radius_meters,
        complaint_ids,
        pattern_type,
        'active',
        NOW(),
        NOW(),
        NOW()
    );
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Cluster created successfully!';
    RAISE NOTICE 'Cluster ID: %', cluster_id;
    RAISE NOTICE 'Cluster Name: Digos City Cluster - %', TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI');
    RAISE NOTICE 'Center: (%, %)', avg_lat, avg_lng;
    RAISE NOTICE 'Radius: % meters', radius_meters;
    RAISE NOTICE 'Complaints: %', array_length(complaint_ids, 1);
    RAISE NOTICE 'Pattern Type: %', pattern_type;
    RAISE NOTICE '========================================';
    
END $$;

-- ============================================================================
-- STEP 4: Verification queries
-- ============================================================================

-- View the created cluster
SELECT 
    id,
    cluster_name,
    center_lat,
    center_lng,
    radius_meters,
    array_length(complaint_ids, 1) as complaint_count,
    pattern_type,
    status,
    created_at
FROM public.complaint_clusters
WHERE cluster_name LIKE 'Digos City Cluster%'
ORDER BY created_at DESC
LIMIT 1;

-- View complaints in the cluster
SELECT 
    c.id as cluster_id,
    c.cluster_name,
    c.center_lat,
    c.center_lng,
    c.radius_meters,
    comp.id as complaint_id,
    comp.title,
    comp.submitted_by,
    comp.latitude,
    comp.longitude,
    comp.workflow_status,
    comp.priority,
    comp.submitted_at
FROM public.complaint_clusters c
CROSS JOIN LATERAL unnest(c.complaint_ids) AS complaint_id
JOIN public.complaints comp ON comp.id = complaint_id
WHERE c.cluster_name LIKE 'Digos City Cluster%'
ORDER BY c.created_at DESC, comp.submitted_at
LIMIT 20;

-- Summary statistics
SELECT 
    COUNT(*) as total_complaints,
    COUNT(DISTINCT submitted_by) as unique_users,
    AVG(latitude) as avg_lat,
    AVG(longitude) as avg_lng,
    MIN(submitted_at) as earliest_complaint,
    MAX(submitted_at) as latest_complaint
FROM public.complaints
WHERE title LIKE 'Sample Complaint%';

-- ============================================================================
-- STEP 5: Cleanup (uncomment to remove test data)
-- ============================================================================

/*
-- Remove cluster
DELETE FROM public.complaint_clusters 
WHERE cluster_name LIKE 'Digos City Cluster%';

-- Remove complaints
DELETE FROM public.complaints 
WHERE title LIKE 'Sample Complaint%';
*/

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. This script uses the actual user IDs you provided
-- 2. Generates one complaint per user (distributed around cluster center)
-- 3. All complaints are within Digos City boundaries
-- 4. Cluster is automatically created from the generated complaints
-- 5. Adjust cluster_center_lat/lng to test different areas of Digos City
-- ============================================================================



