-- WARNING: This script generates synthetic complaint data strictly for testing.
-- It inserts 10,000 randomized complaint rows while leaving UUID columns
-- (except submitted_by) to their default values.

WITH seed AS (
  SELECT
    ARRAY[
      'cc1813e0-7df7-4529-941c-660dc3180a78'::uuid,
      'eada69c6-24e6-479a-9e0f-10c82f49062e'::uuid,
      'b120db0c-eb8b-4ea4-8d0e-09918f961816'::uuid,
      '40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c'::uuid,
      '8e6aa537-86bb-4097-bbd6-b0789f877b9e'::uuid,
      '002a2354-193a-4984-b811-9c01406c92b3'::uuid,
      'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487'::uuid,
      '6fda128c-3438-47aa-a5a5-40462aa66971'::uuid,
      'bf574708-5a85-4eaa-9b3a-5cadb3077e02'::uuid,
      'a3ffc696-3a78-43b7-8893-df3db91e0d9b'::uuid,
      'f006e634-3298-4247-9439-5b11580026b4'::uuid,
      '00e67150-7b3a-4687-b37c-b37b2d6584d8'::uuid,
      'a84b1f04-a7ac-4151-ab86-cb80b1d955ba'::uuid
    ] AS submitter_ids,
    ARRAY['Infrastructure','Environment','Health','Peace & Order','Social Welfare','Utilities']::text[] AS categories,
    ARRAY['Road Damage','Waste Management','Flooding','Health Emergency','Street Light','Noise Disturbance','Illegal Structure','Water Service','Animal Control','Permit Issue']::text[] AS subcategories,
    ARRAY['new','assigned','in_progress','pending_approval','completed','cancelled']::text[] AS workflow_statuses,
    ARRAY['low','medium','high','urgent']::text[] AS priorities,
    ARRAY['pending','waiting_for_responders','waiting_for_complainant','confirmed','disputed']::text[] AS confirmation_statuses,
    ARRAY[
      'Road obstruction','Garbage overflow','Water interruption','Street light outage','Noise disturbance',
      'Drainage clogging','Barangay assistance','Public safety','Animal control','Permit processing',
      'Broken signage','Sewer backflow','Healthcare support','Social aid request','Fire safety inspection'
    ]::text[] AS issue_topics,
    ARRAY[
      'Aplaya','San Jose','Zone 1','Zone 2','Cogon','Tres de Mayo','Zone 3','Lawa','San Miguel','Aurora',
      'Doña Salud','Sto. Niño','Tiguman','Zone 4','San Roque','Goma','Rizal','Maharlika'
    ]::text[] AS barangays,
    ARRAY['DPWH','CENRO','CEO','CHO','CSWD','BFP','PNP','CHED','TESDA','DA','DepEd','MENRO']::text[] AS dept_codes
),
prepared AS (
  SELECT
    gs,
    s.submitter_ids[1 + floor(random() * cardinality(s.submitter_ids))::int] AS submitted_by,
    picks.issue_topic,
    picks.barangay,
    picks.category,
    picks.subcategory,
    picks.workflow_status,
    picks.priority,
    picks.confirmation_status_seed,
    state.submitted_at,
    state.confirmed_by_citizen,
    state.all_responders_confirmed,
    state.is_duplicate,
    s.dept_codes
  FROM generate_series(1, 10000) AS gs
  CROSS JOIN seed AS s
  CROSS JOIN LATERAL (
    SELECT
      s.issue_topics[1 + floor(random() * cardinality(s.issue_topics))::int] AS issue_topic,
      s.barangays[1 + floor(random() * cardinality(s.barangays))::int] AS barangay,
      s.categories[1 + floor(random() * cardinality(s.categories))::int] AS category,
      s.subcategories[1 + floor(random() * cardinality(s.subcategories))::int] AS subcategory,
      s.workflow_statuses[1 + floor(random() * cardinality(s.workflow_statuses))::int] AS workflow_status,
      s.priorities[1 + floor(random() * cardinality(s.priorities))::int] AS priority,
      s.confirmation_statuses[1 + floor(random() * cardinality(s.confirmation_statuses))::int] AS confirmation_status_seed
  ) AS picks
  CROSS JOIN LATERAL (
    SELECT
      timezone('UTC', now())
        - ((floor(random() * 90)::int) || ' days')::interval
        - ((floor(random() * 24)::int) || ' hours')::interval AS submitted_at,
      (random() < 0.55) AS confirmed_by_citizen,
      (random() < 0.65) AS all_responders_confirmed,
      (random() < 0.08) AS is_duplicate
  ) AS state
),
payload AS (
  SELECT
    p.*,
    dept_assign.department_r,
    pref_assign.preferred_departments,
    timeline.response_deadline,
    timeline.estimated_resolution_date,
    timeline.updated_at,
    timeline.last_activity_at,
    timeline.resolved_at,
    timeline.resolution_notes,
    timeline.coordinator_notes,
    timeline.citizen_confirmation_date,
    timeline.responders_confirmation_date,
    timeline.cancellation_reason,
    CASE
      WHEN p.workflow_status = 'new' THEN 'New / Pending'
      WHEN p.workflow_status = 'assigned' THEN 'Assigned'
      WHEN p.workflow_status = 'in_progress' THEN 'In Progress'
      WHEN p.workflow_status = 'pending_approval' THEN 'Pending Approval'
      WHEN p.workflow_status = 'completed' THEN 'Completed / Confirmed'
      WHEN p.workflow_status = 'cancelled' THEN 'Rejected / Disputed'
      ELSE 'New / Pending'
    END AS status_label
  FROM prepared AS p
  CROSS JOIN LATERAL (
    SELECT array_agg(dept_pick) AS department_r
    FROM (
      SELECT p.dept_codes[1 + floor(random() * cardinality(p.dept_codes))::int] AS dept_pick
      FROM generate_series(1, (floor(random() * 3)::int + 1))
    ) AS picks
  ) AS dept_assign
  CROSS JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(dept_pref), '[]'::jsonb) AS preferred_departments
    FROM (
      SELECT DISTINCT p.dept_codes[1 + floor(random() * cardinality(p.dept_codes))::int] AS dept_pref
      FROM generate_series(1, (floor(random() * 2)::int + 1))
    ) AS pref
  ) AS pref_assign
  CROSS JOIN LATERAL (
    SELECT
      p.submitted_at + ((floor(random() * 15)::int + 3) || ' days')::interval AS response_deadline,
      p.submitted_at + ((floor(random() * 25)::int + 5) || ' days')::interval AS estimated_resolution_date,
      p.submitted_at + ((floor(random() * 35)::int + 2) || ' days')::interval AS updated_at,
      p.submitted_at + ((floor(random() * 30)::int + 1) || ' days')::interval AS last_activity_at,
      CASE
        WHEN p.workflow_status = 'completed'
          THEN p.submitted_at + ((floor(random() * 35)::int + 7) || ' days')::interval
        ELSE NULL
      END AS resolved_at,
      CASE
        WHEN p.workflow_status IN ('completed', 'pending_approval')
          THEN concat('Resolution note ref ', substring(md5(random()::text) FROM 1 FOR 16))
        ELSE NULL
      END AS resolution_notes,
      concat('Coordinator note ', substring(md5(random()::text) FROM 1 FOR 12)) AS coordinator_notes,
      CASE
        WHEN p.confirmed_by_citizen
          THEN p.submitted_at + ((floor(random() * 10)::int + 1) || ' days')::interval
        ELSE NULL
      END AS citizen_confirmation_date,
      CASE
        WHEN p.all_responders_confirmed
          THEN p.submitted_at + ((floor(random() * 12)::int + 2) || ' days')::interval
        ELSE NULL
      END AS responders_confirmation_date,
      CASE
        WHEN p.workflow_status = 'cancelled'
          THEN concat('Cancelled due to ', substring(md5(random()::text) FROM 1 FOR 12))
        ELSE NULL
      END AS cancellation_reason
  ) AS timeline
)
INSERT INTO public.complaints (
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
  response_deadline,
  resolution_notes,
  coordinator_notes,
  estimated_resolution_date,
  submitted_at,
  updated_at,
  last_activity_at,
  confirmed_by_citizen,
  citizen_confirmation_date,
  is_duplicate,
  status,
  all_responders_confirmed,
  responders_confirmation_date,
  confirmation_status,
  cancellation_reason,
  resolved_at
)
SELECT
  payload.submitted_by,
  concat('Citizen Complaint ', payload.gs, ': ', payload.issue_topic) AS title,
  concat('Report about ', payload.issue_topic, ' observed in ', payload.barangay, ' needing attention.') AS descriptive_su,
  concat('Purok ', (floor(random() * 12)::int + 1), ', ', payload.barangay, ', Digos City') AS location_text,
  round((6.720000 + random() * 0.250000)::numeric, 6) AS latitude,
  round((125.260000 + random() * 0.130000)::numeric, 6) AS longitude,
  payload.category,
  payload.subcategory,
  payload.department_r,
  payload.preferred_departments,
  payload.workflow_status,
  payload.priority,
  payload.response_deadline,
  payload.resolution_notes,
  payload.coordinator_notes,
  payload.estimated_resolution_date,
  payload.submitted_at,
  payload.updated_at,
  payload.last_activity_at,
  payload.confirmed_by_citizen,
  payload.citizen_confirmation_date,
  payload.is_duplicate,
  payload.status_label,
  payload.all_responders_confirmed,
  payload.responders_confirmation_date,
  CASE
    WHEN payload.confirmed_by_citizen THEN 'confirmed'
    WHEN payload.workflow_status = 'in_progress' AND NOT payload.all_responders_confirmed THEN 'waiting_for_responders'
    ELSE payload.confirmation_status_seed
  END AS confirmation_status,
  payload.cancellation_reason,
  payload.resolved_at
FROM payload;

