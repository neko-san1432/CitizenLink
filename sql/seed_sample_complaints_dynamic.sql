-- ============================================================================
-- Dynamic Seed Data: Sample Complaints
-- Uses actual user IDs from your database
-- ============================================================================

-- Get user IDs dynamically (you can adjust the role filters)
DO $$
DECLARE
  citizen_id1 uuid;
  citizen_id2 uuid;
  coordinator_id uuid;
  officer_id uuid;
  admin_id uuid;
BEGIN
  -- Get a citizen user
  SELECT id INTO citizen_id1 
  FROM auth.users 
  WHERE raw_user_meta_data->>'role' = 'citizen' 
  LIMIT 1;
  
  -- Get another citizen (or use same if only one exists)
  SELECT id INTO citizen_id2 
  FROM auth.users 
  WHERE raw_user_meta_data->>'role' = 'citizen' 
  OFFSET 1 LIMIT 1;
  
  -- If no second citizen, use first one
  IF citizen_id2 IS NULL THEN
    citizen_id2 := citizen_id1;
  END IF;
  
  -- Get coordinator
  SELECT id INTO coordinator_id 
  FROM auth.users 
  WHERE raw_user_meta_data->>'role' = 'complaint-coordinator' 
  LIMIT 1;
  
  -- Get LGU officer (any lgu- role that's not admin or hr)
  SELECT id INTO officer_id 
  FROM auth.users 
  WHERE raw_user_meta_data->>'role' LIKE 'lgu-%' 
    AND raw_user_meta_data->>'role' NOT LIKE 'lgu-admin%'
    AND raw_user_meta_data->>'role' NOT LIKE 'lgu-hr%'
  LIMIT 1;
  
  -- Get LGU admin
  SELECT id INTO admin_id 
  FROM auth.users 
  WHERE raw_user_meta_data->>'role' LIKE 'lgu-admin%' 
  LIMIT 1;
  
  -- Only proceed if we have at least a citizen
  IF citizen_id1 IS NOT NULL THEN
    
    -- Complaint 1: Pending Review (for coordinator)
    INSERT INTO public.complaints (
      submitted_by, title, type, subtype, descriptive_su, location_text,
      latitude, longitude, department_r, status, workflow_status, priority,
      submitted_at, updated_at
    ) VALUES (
      citizen_id1,
      'Broken Street Light on Oak Avenue',
      'Infrastructure',
      'Street Lighting',
      'The street light near house #42 Oak Avenue has been out for a week. It is very dark at night and unsafe for pedestrians.',
      'Oak Avenue, near house #42',
      14.5995, 120.9842,
      ARRAY['public-works'],
      'pending review',
      'new',
      'medium',
      NOW() - INTERVAL '2 days',
      NOW() - INTERVAL '2 days'
    );
    
    -- Complaint 2: Pending Review (for coordinator)
    INSERT INTO public.complaints (
      submitted_by, title, type, subtype, descriptive_su, location_text,
      latitude, longitude, department_r, status, workflow_status, priority,
      submitted_at, updated_at
    ) VALUES (
      citizen_id2,
      'Uncollected Garbage for 3 Days',
      'Sanitation',
      'Waste Collection',
      'Garbage has not been collected for 3 days on Maple Street. Starting to smell and attract pests.',
      'Maple Street, Block 5',
      14.6008, 120.9850,
      ARRAY['environmental'],
      'pending review',
      'new',
      'high',
      NOW() - INTERVAL '1 day',
      NOW() - INTERVAL '1 day'
    );
    
    -- Complaint 3: In Progress (if we have officer and admin)
    IF officer_id IS NOT NULL AND admin_id IS NOT NULL AND coordinator_id IS NOT NULL THEN
      INSERT INTO public.complaints (
        submitted_by, title, type, subtype, descriptive_su, location_text,
        latitude, longitude, department_r, status, workflow_status, priority,
        primary_department, assigned_coordinator_id, submitted_at, updated_at
      ) VALUES (
        citizen_id1,
        'Water Leak at Community Park',
        'Infrastructure',
        'Water Supply',
        'There is a continuous water leak at the community park fountain. Water is being wasted.',
        'Community Park, Central Plaza',
        14.6000, 120.9845,
        ARRAY['wst'],
        'in progress',
        'in_progress',
        'medium',
        'wst',
        coordinator_id,
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '1 day'
      );
      
      -- Get the ID of the complaint we just inserted
      DECLARE complaint3_id uuid;
      BEGIN
        SELECT id INTO complaint3_id 
        FROM public.complaints 
        WHERE title = 'Water Leak at Community Park' 
        ORDER BY submitted_at DESC 
        LIMIT 1;
        
        -- Assignment for Complaint 3
        IF complaint3_id IS NOT NULL THEN
          INSERT INTO public.complaint_assignments (
            complaint_id, assigned_to, assigned_by, status, priority, deadline
          ) VALUES (
            complaint3_id,
            officer_id,
            admin_id,
            'active',
            'medium',
            NOW() + INTERVAL '5 days'
          );
        END IF;
      END;
    END IF;
    
    -- Complaint 4: Resolved
    INSERT INTO public.complaints (
      submitted_by, title, type, subtype, descriptive_su, location_text,
      latitude, longitude, department_r, status, workflow_status, priority,
      primary_department, submitted_at, updated_at
    ) VALUES (
      citizen_id1,
      'Pothole on Main Road',
      'Infrastructure',
      'Road Maintenance',
      'Large pothole causing traffic issues on Main Road near the intersection.',
      'Main Road x 1st Street',
      14.5990, 120.9838,
      ARRAY['public-works'],
      'resolved',
      'completed',
      'high',
      'public-works',
      NOW() - INTERVAL '10 days',
      NOW() - INTERVAL '1 day'
    );
    
    -- Complaint 5: New/Submitted
    INSERT INTO public.complaints (
      submitted_by, title, type, subtype, descriptive_su, location_text,
      latitude, longitude, department_r, status, workflow_status, priority,
      submitted_at, updated_at
    ) VALUES (
      citizen_id2,
      'Noise Complaint - Construction',
      'Community',
      'Noise Pollution',
      'Construction noise starting at 5 AM daily. Extremely loud and disturbing.',
      'Elm Street, Construction Site',
      14.6005, 120.9855,
      ARRAY['public-safety'],
      'pending review',
      'new',
      'medium',
      NOW() - INTERVAL '12 hours',
      NOW() - INTERVAL '12 hours'
    );
    
    RAISE NOTICE 'Successfully created 5 sample complaints!';
    RAISE NOTICE 'Citizen ID used: %', citizen_id1;
    IF coordinator_id IS NOT NULL THEN
      RAISE NOTICE 'Coordinator ID used: %', coordinator_id;
    END IF;
    IF officer_id IS NOT NULL THEN
      RAISE NOTICE 'Officer ID used: %', officer_id;
    END IF;
    
  ELSE
    RAISE WARNING 'No citizen users found! Please create at least one citizen user first.';
  END IF;
  
END $$;

