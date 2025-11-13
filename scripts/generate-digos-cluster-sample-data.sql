-- ============================================================================
-- Digos City Cluster Sample Data Generator (Generic Version)
-- ============================================================================
-- This script generates sample complaint data and clusters within Digos City boundaries
-- 
-- NOTE: For production use with real user IDs, use: create-digos-cluster-with-users.sql
-- 
-- Usage: Run this script in your PostgreSQL/Supabase database
-- 
-- EPS Value: 0.01 (degrees) ≈ 1.1 km
-- Clustering Radius: 0.5 km (500 meters)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create a function to check if coordinates are within Digos boundary
-- ============================================================================

CREATE OR REPLACE FUNCTION is_within_digos_boundary(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
) RETURNS BOOLEAN AS $$
DECLARE
    -- Digos City boundary coordinates (from digos-city-boundary.json)
    -- Using simplified bounding box for SQL (full polygon check would require PostGIS)
    min_lat DOUBLE PRECISION := 6.723539;
    max_lat DOUBLE PRECISION := 6.985025;
    min_lng DOUBLE PRECISION := 125.245633;
    max_lng DOUBLE PRECISION := 125.391290;
BEGIN
    -- Quick bounding box check
    IF lat < min_lat OR lat > max_lat OR lng < min_lng OR lng > max_lng THEN
        RETURN FALSE;
    END IF;
    
    -- For more accurate validation, you would use PostGIS:
    -- RETURN ST_Within(ST_SetSRID(ST_MakePoint(lng, lat), 4326), digos_boundary_geom);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: Generate sample complaints within Digos City boundaries
-- ============================================================================
-- Note: Replace 'USER_UUID_HERE' with an actual user UUID from auth.users

DO $$
DECLARE
    -- Sample user UUID (replace with actual user UUID)
    sample_user_id UUID := '00000000-0000-0000-0000-000000000000';
    
    -- Cluster center coordinates (within Digos)
    cluster_center_lat DOUBLE PRECISION := 6.7666;
    cluster_center_lng DOUBLE PRECISION := 125.2869;
    
    -- Complaint IDs for cluster
    complaint_ids UUID[] := ARRAY[]::UUID[];
    
    -- Temporary variables
    complaint_id UUID;
    i INTEGER;
    angle DOUBLE PRECISION;
    distance DOUBLE PRECISION;
    lat_offset DOUBLE PRECISION;
    lng_offset DOUBLE PRECISION;
    complaint_lat DOUBLE PRECISION;
    complaint_lng DOUBLE PRECISION;
BEGIN
    -- Check if sample user exists, if not create a placeholder
    -- In production, use an actual user UUID
    
    -- Generate 5 sample complaints around cluster center (within 0.5 km radius)
    FOR i IN 1..5 LOOP
        -- Generate random point within 0.5 km of cluster center
        angle := (i - 1) * (2 * PI() / 5); -- Distribute evenly around circle
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
        
        -- Insert sample complaint
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
            sample_user_id,
            'Sample Complaint ' || i || ' - Infrastructure Issue',
            'This is a sample complaint generated for testing cluster detection. Located in Digos City, Davao del Sur.',
            'Digos City, Davao del Sur',
            complaint_lat,
            complaint_lng,
            'Infrastructure',
            'General',
            ARRAY['DPWH', 'ENRO']::TEXT[],
            '[]'::JSONB,
            CASE (i % 5)
                WHEN 0 THEN 'new'
                WHEN 1 THEN 'assigned'
                WHEN 2 THEN 'in_progress'
                WHEN 3 THEN 'pending_approval'
                ELSE 'completed'
            END,
            CASE (i % 4)
                WHEN 0 THEN 'low'
                WHEN 1 THEN 'medium'
                WHEN 2 THEN 'high'
                ELSE 'urgent'
            END,
            'pending',
            NOW(),
            NOW(),
            NOW(),
            'pending',
            FALSE,
            FALSE
        );
        
        RAISE NOTICE 'Inserted complaint %: (%, %)', i, complaint_lat, complaint_lng;
    END LOOP;
    
    -- ============================================================================
    -- STEP 3: Create cluster from the generated complaints
    -- ============================================================================
    
    -- Calculate cluster center (average of complaint coordinates)
    DECLARE
        avg_lat DOUBLE PRECISION;
        avg_lng DOUBLE PRECISION;
        max_radius DOUBLE PRECISION;
        radius_meters INTEGER;
        pattern_type TEXT;
    BEGIN
        -- Calculate average coordinates
        SELECT 
            AVG(latitude),
            AVG(longitude)
        INTO avg_lat, avg_lng
        FROM public.complaints
        WHERE id = ANY(complaint_ids);
        
        -- Calculate maximum radius from center
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
            gen_random_uuid(),
            'Digos City Cluster - ' || TO_CHAR(NOW(), 'YYYY-MM-DD'),
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
        
        RAISE NOTICE 'Created cluster: center (%, %), radius % meters, % complaints', 
            avg_lat, avg_lng, radius_meters, array_length(complaint_ids, 1);
    END;
    
    RAISE NOTICE 'Sample data generation completed successfully!';
END $$;

-- ============================================================================
-- STEP 4: Verification queries
-- ============================================================================

-- View generated complaints
SELECT 
    id,
    title,
    latitude,
    longitude,
    workflow_status,
    priority,
    submitted_at
FROM public.complaints
WHERE title LIKE 'Sample Complaint%'
ORDER BY submitted_at DESC;

-- View generated cluster
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
ORDER BY created_at DESC;

-- View cluster with complaint details
SELECT 
    c.id as cluster_id,
    c.cluster_name,
    c.center_lat,
    c.center_lng,
    c.radius_meters,
    c.pattern_type,
    comp.id as complaint_id,
    comp.title,
    comp.latitude,
    comp.longitude,
    comp.workflow_status
FROM public.complaint_clusters c
CROSS JOIN LATERAL unnest(c.complaint_ids) AS complaint_id
JOIN public.complaints comp ON comp.id = complaint_id
WHERE c.cluster_name LIKE 'Digos City Cluster%'
ORDER BY c.created_at DESC, comp.submitted_at;

-- ============================================================================
-- STEP 5: Cleanup function (optional - use to remove test data)
-- ============================================================================

-- Uncomment to remove test data:
/*
DELETE FROM public.complaint_clusters 
WHERE cluster_name LIKE 'Digos City Cluster%';

DELETE FROM public.complaints 
WHERE title LIKE 'Sample Complaint%';
*/

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. Replace 'sample_user_id' with an actual user UUID from auth.users
-- 2. For more accurate boundary validation, install PostGIS and use ST_Within()
-- 3. Adjust the number of complaints (currently 5) as needed
-- 4. Modify cluster center coordinates to test different areas of Digos City
-- 5. The script uses approximate distance calculations - for production, use PostGIS
-- ============================================================================

