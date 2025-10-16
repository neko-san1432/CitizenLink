-- ============================================================================
-- Seed Data: Complaints and Notifications
-- 20 complaints with various states and notifications
-- ============================================================================

-- User IDs for reference:
-- Citizens:
--   a8b39c14-7e02-4a10-b920-63b4f2a76aa7
--   daa0d31f-1fa5-4164-92e0-e43462b29bea
--   8915024b-0368-44c1-9361-00ffd8275066
--   b9ffacfb-eaa3-4128-8785-9811cffb72c8
--   dc3a8b92-6518-40c8-9102-11b935dc6a5a
-- Coordinator: 37b260b0-141f-4609-b6e3-77e103ada3e9
-- Officer: 0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2
-- Admin: 8c32ca0b-0203-4054-b5ff-72501c8e9d80

-- ============================================================================
-- PART 1: 5 WST Department Complaints (3 assigned to officer, 2 completed)
-- ============================================================================

-- WST Complaint 1: Assigned to officer, in progress
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, department_r, status, workflow_status, priority,
  primary_department, assigned_coordinator_id, submitted_at, updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'a8b39c14-7e02-4a10-b920-63b4f2a76aa7',
  'Broken Water Pipe on Main Street',
  'Infrastructure',
  'Water Supply',
  'Large water pipe burst causing flooding on Main Street. Immediate attention needed.',
  'Main Street, Corner 5th Ave',
  14.5995, 120.9842,
  ARRAY['wst'],
  'in progress',
  'in_progress',
  'urgent',
  'wst',
  '37b260b0-141f-4609-b6e3-77e103ada3e9',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '1 day'
);

-- Assignment for WST Complaint 1
INSERT INTO public.complaint_assignments (
  complaint_id, assigned_to, assigned_by, status, priority, deadline
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2',
  '8c32ca0b-0203-4054-b5ff-72501c8e9d80',
  'active',
  'urgent',
  NOW() + INTERVAL '1 day'
);

-- Notifications for WST Complaint 1
INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
-- Citizen notification
('a8b39c14-7e02-4a10-b920-63b4f2a76aa7', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Broken Water Pipe on Main Street" has been received and is being reviewed.', '✅', '/citizen/complaints/11111111-1111-1111-1111-111111111111', '{"complaint_id": "11111111-1111-1111-1111-111111111111"}', true, NOW() - INTERVAL '2 days'),
-- Coordinator notification
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Broken Water Pipe on Main Street" needs your review and assignment.', '📋', '/coordinator/review/11111111-1111-1111-1111-111111111111', '{"complaint_id": "11111111-1111-1111-1111-111111111111"}', true, NOW() - INTERVAL '2 days'),
-- Admin notification
('8c32ca0b-0203-4054-b5ff-72501c8e9d80', 'approval_required', 'info', 'New Complaint Assigned to Your Department', '"Broken Water Pipe on Main Street" has been assigned to wst.', '📢', '/lgu/department/wst/complaints/11111111-1111-1111-1111-111111111111', '{"complaint_id": "11111111-1111-1111-1111-111111111111", "department": "wst"}', true, NOW() - INTERVAL '2 days'),
-- Officer notification
('0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2', 'task_assigned', 'urgent', 'New Task Assigned', 'You''ve been assigned: "Broken Water Pipe on Main Street" - Due: ' || TO_CHAR(NOW() + INTERVAL '1 day', 'Mon DD, YYYY'), '🎯', '/lgu/tasks/11111111-1111-1111-1111-111111111111', '{"complaint_id": "11111111-1111-1111-1111-111111111111", "priority": "urgent"}', false, NOW() - INTERVAL '1 day');

-- WST Complaint 2: Assigned to officer, in progress
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, department_r, status, workflow_status, priority,
  primary_department, assigned_coordinator_id, submitted_at, updated_at
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'daa0d31f-1fa5-4164-92e0-e43462b29bea',
  'Clogged Drainage System',
  'Infrastructure',
  'Drainage',
  'Drainage system completely clogged causing water accumulation during rain.',
  'Park Avenue, Block 3',
  14.6010, 120.9850,
  ARRAY['wst'],
  'in progress',
  'in_progress',
  'high',
  'wst',
  '37b260b0-141f-4609-b6e3-77e103ada3e9',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '2 days'
);

INSERT INTO public.complaint_assignments (
  complaint_id, assigned_to, assigned_by, status, priority, deadline
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2',
  '8c32ca0b-0203-4054-b5ff-72501c8e9d80',
  'active',
  'high',
  NOW() + INTERVAL '2 days'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('daa0d31f-1fa5-4164-92e0-e43462b29bea', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Clogged Drainage System" has been received and is being reviewed.', '✅', '/citizen/complaints/22222222-2222-2222-2222-222222222222', '{"complaint_id": "22222222-2222-2222-2222-222222222222"}', true, NOW() - INTERVAL '3 days'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Clogged Drainage System" needs your review and assignment.', '📋', '/coordinator/review/22222222-2222-2222-2222-222222222222', '{"complaint_id": "22222222-2222-2222-2222-222222222222"}', true, NOW() - INTERVAL '3 days'),
('8c32ca0b-0203-4054-b5ff-72501c8e9d80', 'approval_required', 'info', 'New Complaint Assigned to Your Department', '"Clogged Drainage System" has been assigned to wst.', '📢', '/lgu/department/wst/complaints/22222222-2222-2222-2222-222222222222', '{"complaint_id": "22222222-2222-2222-2222-222222222222", "department": "wst"}', true, NOW() - INTERVAL '3 days'),
('0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2', 'task_assigned', 'warning', 'New Task Assigned', 'You''ve been assigned: "Clogged Drainage System" - Due: ' || TO_CHAR(NOW() + INTERVAL '2 days', 'Mon DD, YYYY'), '🎯', '/lgu/tasks/22222222-2222-2222-2222-222222222222', '{"complaint_id": "22222222-2222-2222-2222-222222222222", "priority": "high"}', false, NOW() - INTERVAL '2 days');

-- WST Complaint 3: Assigned to officer, in progress
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, department_r, status, workflow_status, priority,
  primary_department, assigned_coordinator_id, submitted_at, updated_at
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '8915024b-0368-44c1-9361-00ffd8275066',
  'Sewage Overflow Near School',
  'Infrastructure',
  'Sewage',
  'Sewage system overflowing near elementary school. Health hazard.',
  'School Road, Barangay 5',
  14.5980, 120.9835,
  ARRAY['wst'],
  'in progress',
  'in_progress',
  'urgent',
  'wst',
  '37b260b0-141f-4609-b6e3-77e103ada3e9',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '12 hours'
);

INSERT INTO public.complaint_assignments (
  complaint_id, assigned_to, assigned_by, status, priority, deadline
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2',
  '8c32ca0b-0203-4054-b5ff-72501c8e9d80',
  'active',
  'urgent',
  NOW() + INTERVAL '6 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('8915024b-0368-44c1-9361-00ffd8275066', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Sewage Overflow Near School" has been received and is being reviewed.', '✅', '/citizen/complaints/33333333-3333-3333-3333-333333333333', '{"complaint_id": "33333333-3333-3333-3333-333333333333"}', true, NOW() - INTERVAL '1 day'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Sewage Overflow Near School" needs your review and assignment.', '📋', '/coordinator/review/33333333-3333-3333-3333-333333333333', '{"complaint_id": "33333333-3333-3333-3333-333333333333"}', true, NOW() - INTERVAL '1 day'),
('8c32ca0b-0203-4054-b5ff-72501c8e9d80', 'approval_required', 'urgent', 'New Complaint Assigned to Your Department', '"Sewage Overflow Near School" has been assigned to wst.', '📢', '/lgu/department/wst/complaints/33333333-3333-3333-3333-333333333333', '{"complaint_id": "33333333-3333-3333-3333-333333333333", "department": "wst"}', false, NOW() - INTERVAL '1 day'),
('0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2', 'task_assigned', 'urgent', 'New Task Assigned', 'You''ve been assigned: "Sewage Overflow Near School" - Due: ' || TO_CHAR(NOW() + INTERVAL '6 hours', 'Mon DD, YYYY HH24:MI'), '🎯', '/lgu/tasks/33333333-3333-3333-3333-333333333333', '{"complaint_id": "33333333-3333-3333-3333-333333333333", "priority": "urgent"}', false, NOW() - INTERVAL '12 hours');

-- WST Complaint 4: COMPLETED
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, department_r, status, workflow_status, priority,
  primary_department, assigned_coordinator_id, submitted_at, updated_at
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'b9ffacfb-eaa3-4128-8785-9811cffb72c8',
  'Water Meter Reading Issue',
  'Infrastructure',
  'Water Supply',
  'Water meter showing incorrect readings causing billing issues.',
  'Residential Complex A, Unit 12',
  14.6005, 120.9845,
  ARRAY['wst'],
  'resolved',
  'completed',
  'medium',
  'wst',
  '37b260b0-141f-4609-b6e3-77e103ada3e9',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '1 hour'
);

INSERT INTO public.complaint_assignments (
  complaint_id, assigned_to, assigned_by, status, priority, deadline, completed_at
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  '0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2',
  '8c32ca0b-0203-4054-b5ff-72501c8e9d80',
  'completed',
  'medium',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '1 hour'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('b9ffacfb-eaa3-4128-8785-9811cffb72c8', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Water Meter Reading Issue" has been received and is being reviewed.', '✅', '/citizen/complaints/44444444-4444-4444-4444-444444444444', '{"complaint_id": "44444444-4444-4444-4444-444444444444"}', true, NOW() - INTERVAL '5 days'),
('b9ffacfb-eaa3-4128-8785-9811cffb72c8', 'complaint_status_changed', 'info', 'Complaint Status Updated', 'Your complaint "Water Meter Reading Issue" has been resolved.', '✅', '/citizen/complaints/44444444-4444-4444-4444-444444444444', '{"complaint_id": "44444444-4444-4444-4444-444444444444", "old_status": "in progress", "new_status": "resolved"}', false, NOW() - INTERVAL '1 hour');

-- WST Complaint 5: COMPLETED
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, department_r, status, workflow_status, priority,
  primary_department, assigned_coordinator_id, submitted_at, updated_at
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'dc3a8b92-6518-40c8-9102-11b935dc6a5a',
  'Fire Hydrant Not Working',
  'Infrastructure',
  'Water Supply',
  'Fire hydrant on corner street not functioning. Safety concern.',
  'Corner Street & Maple Ave',
  14.6000, 120.9840,
  ARRAY['wst'],
  'resolved',
  'completed',
  'high',
  'wst',
  '37b260b0-141f-4609-b6e3-77e103ada3e9',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '6 hours'
);

INSERT INTO public.complaint_assignments (
  complaint_id, assigned_to, assigned_by, status, priority, deadline, completed_at
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  '0b5dcace-6c73-4bbf-9dd0-4d2a49b956d2',
  '8c32ca0b-0203-4054-b5ff-72501c8e9d80',
  'completed',
  'high',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '6 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('dc3a8b92-6518-40c8-9102-11b935dc6a5a', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Fire Hydrant Not Working" has been received and is being reviewed.', '✅', '/citizen/complaints/55555555-5555-5555-5555-555555555555', '{"complaint_id": "55555555-5555-5555-5555-555555555555"}', true, NOW() - INTERVAL '4 days'),
('dc3a8b92-6518-40c8-9102-11b935dc6a5a', 'complaint_status_changed', 'info', 'Complaint Status Updated', 'Your complaint "Fire Hydrant Not Working" has been resolved.', '✅', '/citizen/complaints/55555555-5555-5555-5555-555555555555', '{"complaint_id": "55555555-5555-5555-5555-555555555555", "old_status": "in progress", "new_status": "resolved"}', false, NOW() - INTERVAL '6 hours');

-- ============================================================================
-- PART 2: 10 Unassigned Complaints (pending review by coordinator)
-- ============================================================================

-- Unassigned Complaint 1
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  'a8b39c14-7e02-4a10-b920-63b4f2a76aa7',
  'Pothole on Highway',
  'Infrastructure',
  'Roads',
  'Large pothole causing traffic hazard on main highway.',
  'National Highway, KM 15',
  14.5990, 120.9838,
  'pending review',
  'new',
  'medium',
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('a8b39c14-7e02-4a10-b920-63b4f2a76aa7', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Pothole on Highway" has been received and is being reviewed.', '✅', '/citizen/complaints/66666666-6666-6666-6666-666666666666', '{"complaint_id": "66666666-6666-6666-6666-666666666666"}', false, NOW() - INTERVAL '3 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Pothole on Highway" needs your review and assignment.', '📋', '/coordinator/review/66666666-6666-6666-6666-666666666666', '{"complaint_id": "66666666-6666-6666-6666-666666666666"}', false, NOW() - INTERVAL '3 hours');

-- Unassigned Complaint 2
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '77777777-7777-7777-7777-777777777777',
  'daa0d31f-1fa5-4164-92e0-e43462b29bea',
  'Streetlight Not Working',
  'Infrastructure',
  'Electrical',
  'Multiple streetlights not functioning, area very dark at night.',
  'Oak Street, between 2nd and 3rd Ave',
  14.6015, 120.9855,
  'pending review',
  'new',
  'medium',
  NOW() - INTERVAL '5 hours',
  NOW() - INTERVAL '5 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('daa0d31f-1fa5-4164-92e0-e43462b29bea', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Streetlight Not Working" has been received and is being reviewed.', '✅', '/citizen/complaints/77777777-7777-7777-7777-777777777777', '{"complaint_id": "77777777-7777-7777-7777-777777777777"}', false, NOW() - INTERVAL '5 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Streetlight Not Working" needs your review and assignment.', '📋', '/coordinator/review/77777777-7777-7777-7777-777777777777', '{"complaint_id": "77777777-7777-7777-7777-777777777777"}', false, NOW() - INTERVAL '5 hours');

-- Unassigned Complaint 3
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '88888888-8888-8888-8888-888888888888',
  '8915024b-0368-44c1-9361-00ffd8275066',
  'Garbage Collection Missed',
  'Sanitation',
  'Waste Management',
  'Garbage not collected for 3 days, starting to smell.',
  'Residential Area B, Street 4',
  14.5985, 120.9832,
  'pending review',
  'new',
  'low',
  NOW() - INTERVAL '8 hours',
  NOW() - INTERVAL '8 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('8915024b-0368-44c1-9361-00ffd8275066', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Garbage Collection Missed" has been received and is being reviewed.', '✅', '/citizen/complaints/88888888-8888-8888-8888-888888888888', '{"complaint_id": "88888888-8888-8888-8888-888888888888"}', false, NOW() - INTERVAL '8 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Garbage Collection Missed" needs your review and assignment.', '📋', '/coordinator/review/88888888-8888-8888-8888-888888888888', '{"complaint_id": "88888888-8888-8888-8888-888888888888"}', false, NOW() - INTERVAL '8 hours');

-- Unassigned Complaint 4
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '99999999-9999-9999-9999-999999999999',
  'b9ffacfb-eaa3-4128-8785-9811cffb72c8',
  'Illegal Dumping Site',
  'Environment',
  'Waste Management',
  'People dumping trash illegally in vacant lot causing health hazard.',
  'Vacant Lot, Corner Pine & Cedar',
  14.6020, 120.9860,
  'pending review',
  'new',
  'high',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('b9ffacfb-eaa3-4128-8785-9811cffb72c8', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Illegal Dumping Site" has been received and is being reviewed.', '✅', '/citizen/complaints/99999999-9999-9999-9999-999999999999', '{"complaint_id": "99999999-9999-9999-9999-999999999999"}', false, NOW() - INTERVAL '2 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'warning', 'New Complaint for Review', '"Illegal Dumping Site" needs your review and assignment.', '📋', '/coordinator/review/99999999-9999-9999-9999-999999999999', '{"complaint_id": "99999999-9999-9999-9999-999999999999"}', false, NOW() - INTERVAL '2 hours');

-- Unassigned Complaint 5
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'dc3a8b92-6518-40c8-9102-11b935dc6a5a',
  'Noise Pollution from Construction',
  'Environment',
  'Noise',
  'Construction site making excessive noise late at night.',
  'Downtown Area, Block 7',
  14.5995, 120.9848,
  'pending review',
  'new',
  'medium',
  NOW() - INTERVAL '4 hours',
  NOW() - INTERVAL '4 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('dc3a8b92-6518-40c8-9102-11b935dc6a5a', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Noise Pollution from Construction" has been received and is being reviewed.', '✅', '/citizen/complaints/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"complaint_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}', false, NOW() - INTERVAL '4 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Noise Pollution from Construction" needs your review and assignment.', '📋', '/coordinator/review/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"complaint_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}', false, NOW() - INTERVAL '4 hours');

-- Unassigned Complaint 6
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'a8b39c14-7e02-4a10-b920-63b4f2a76aa7',
  'Stray Dogs in Residential Area',
  'Public Safety',
  'Animal Control',
  'Pack of stray dogs roaming residential area, safety concern for children.',
  'Residential Complex C',
  14.6008, 120.9852,
  'pending review',
  'new',
  'high',
  NOW() - INTERVAL '6 hours',
  NOW() - INTERVAL '6 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('a8b39c14-7e02-4a10-b920-63b4f2a76aa7', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Stray Dogs in Residential Area" has been received and is being reviewed.', '✅', '/citizen/complaints/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"complaint_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}', false, NOW() - INTERVAL '6 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'warning', 'New Complaint for Review', '"Stray Dogs in Residential Area" needs your review and assignment.', '📋', '/coordinator/review/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"complaint_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}', false, NOW() - INTERVAL '6 hours');

-- Unassigned Complaint 7
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'daa0d31f-1fa5-4164-92e0-e43462b29bea',
  'Abandoned Vehicle on Street',
  'Public Safety',
  'Traffic',
  'Abandoned car blocking street for over a week.',
  'Elm Street, near Park',
  14.5992, 120.9836,
  'pending review',
  'new',
  'low',
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '1 hour'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('daa0d31f-1fa5-4164-92e0-e43462b29bea', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Abandoned Vehicle on Street" has been received and is being reviewed.', '✅', '/citizen/complaints/cccccccc-cccc-cccc-cccc-cccccccccccc', '{"complaint_id": "cccccccc-cccc-cccc-cccc-cccccccccccc"}', false, NOW() - INTERVAL '1 hour'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Abandoned Vehicle on Street" needs your review and assignment.', '📋', '/coordinator/review/cccccccc-cccc-cccc-cccc-cccccccccccc', '{"complaint_id": "cccccccc-cccc-cccc-cccc-cccccccccccc"}', false, NOW() - INTERVAL '1 hour');

-- Unassigned Complaint 8
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  '8915024b-0368-44c1-9361-00ffd8275066',
  'Broken Traffic Light',
  'Infrastructure',
  'Traffic',
  'Traffic light at busy intersection not working, causing accidents.',
  'Main St & 1st Ave Intersection',
  14.6012, 120.9858,
  'pending review',
  'new',
  'urgent',
  NOW() - INTERVAL '30 minutes',
  NOW() - INTERVAL '30 minutes'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('8915024b-0368-44c1-9361-00ffd8275066', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Broken Traffic Light" has been received and is being reviewed.', '✅', '/citizen/complaints/dddddddd-dddd-dddd-dddd-dddddddddddd', '{"complaint_id": "dddddddd-dddd-dddd-dddd-dddddddddddd"}', false, NOW() - INTERVAL '30 minutes'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'urgent', 'New Complaint for Review', '"Broken Traffic Light" needs your review and assignment.', '📋', '/coordinator/review/dddddddd-dddd-dddd-dddd-dddddddddddd', '{"complaint_id": "dddddddd-dddd-dddd-dddd-dddddddddddd"}', false, NOW() - INTERVAL '30 minutes');

-- Unassigned Complaint 9
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  'b9ffacfb-eaa3-4128-8785-9811cffb72c8',
  'Flooding After Rain',
  'Infrastructure',
  'Drainage',
  'Street floods heavily after rain, water reaches knee-high.',
  'Low-lying Area, Valley Road',
  14.5988, 120.9830,
  'pending review',
  'new',
  'high',
  NOW() - INTERVAL '7 hours',
  NOW() - INTERVAL '7 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('b9ffacfb-eaa3-4128-8785-9811cffb72c8', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Flooding After Rain" has been received and is being reviewed.', '✅', '/citizen/complaints/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '{"complaint_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"}', false, NOW() - INTERVAL '7 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'warning', 'New Complaint for Review', '"Flooding After Rain" needs your review and assignment.', '📋', '/coordinator/review/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '{"complaint_id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"}', false, NOW() - INTERVAL '7 hours');

-- Unassigned Complaint 10
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'dc3a8b92-6518-40c8-9102-11b935dc6a5a',
  'Sidewalk Damage',
  'Infrastructure',
  'Roads',
  'Large crack in sidewalk posing tripping hazard.',
  'Market Street, in front of Mall',
  14.6018, 120.9865,
  'pending review',
  'new',
  'medium',
  NOW() - INTERVAL '9 hours',
  NOW() - INTERVAL '9 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('dc3a8b92-6518-40c8-9102-11b935dc6a5a', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Sidewalk Damage" has been received and is being reviewed.', '✅', '/citizen/complaints/ffffffff-ffff-ffff-ffff-ffffffffffff', '{"complaint_id": "ffffffff-ffff-ffff-ffff-ffffffffffff"}', false, NOW() - INTERVAL '9 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Sidewalk Damage" needs your review and assignment.', '📋', '/coordinator/review/ffffffff-ffff-ffff-ffff-ffffffffffff', '{"complaint_id": "ffffffff-ffff-ffff-ffff-ffffffffffff"}', false, NOW() - INTERVAL '9 hours');

-- ============================================================================
-- PART 3: 5 Additional Mixed Complaints (various departments)
-- ============================================================================

-- Mixed Complaint 1
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '10101010-1010-1010-1010-101010101010',
  'a8b39c14-7e02-4a10-b920-63b4f2a76aa7',
  'Park Maintenance Needed',
  'Parks',
  'Maintenance',
  'Public park playground equipment broken and needs repair.',
  'Central Park, Children''s Area',
  14.6002, 120.9844,
  'pending review',
  'new',
  'low',
  NOW() - INTERVAL '10 hours',
  NOW() - INTERVAL '10 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('a8b39c14-7e02-4a10-b920-63b4f2a76aa7', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Park Maintenance Needed" has been received and is being reviewed.', '✅', '/citizen/complaints/10101010-1010-1010-1010-101010101010', '{"complaint_id": "10101010-1010-1010-1010-101010101010"}', false, NOW() - INTERVAL '10 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Park Maintenance Needed" needs your review and assignment.', '📋', '/coordinator/review/10101010-1010-1010-1010-101010101010', '{"complaint_id": "10101010-1010-1010-1010-101010101010"}', false, NOW() - INTERVAL '10 hours');

-- Mixed Complaint 2
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '20202020-2020-2020-2020-202020202020',
  'daa0d31f-1fa5-4164-92e0-e43462b29bea',
  'Air Quality Concerns',
  'Environment',
  'Air Quality',
  'Heavy smoke from nearby factory affecting air quality.',
  'Industrial Area, Zone 3',
  14.5975, 120.9825,
  'pending review',
  'new',
  'high',
  NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '12 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('daa0d31f-1fa5-4164-92e0-e43462b29bea', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Air Quality Concerns" has been received and is being reviewed.', '✅', '/citizen/complaints/20202020-2020-2020-2020-202020202020', '{"complaint_id": "20202020-2020-2020-2020-202020202020"}', false, NOW() - INTERVAL '12 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'warning', 'New Complaint for Review', '"Air Quality Concerns" needs your review and assignment.', '📋', '/coordinator/review/20202020-2020-2020-2020-202020202020', '{"complaint_id": "20202020-2020-2020-2020-202020202020"}', false, NOW() - INTERVAL '12 hours');

-- Mixed Complaint 3
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '30303030-3030-3030-3030-303030303030',
  '8915024b-0368-44c1-9361-00ffd8275066',
  'Building Permit Inquiry',
  'Building',
  'Permits',
  'Neighbor constructing without visible permits, safety concern.',
  'Residential Block D, Lot 25',
  14.6025, 120.9870,
  'pending review',
  'new',
  'medium',
  NOW() - INTERVAL '15 hours',
  NOW() - INTERVAL '15 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('8915024b-0368-44c1-9361-00ffd8275066', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Building Permit Inquiry" has been received and is being reviewed.', '✅', '/citizen/complaints/30303030-3030-3030-3030-303030303030', '{"complaint_id": "30303030-3030-3030-3030-303030303030"}', false, NOW() - INTERVAL '15 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Building Permit Inquiry" needs your review and assignment.', '📋', '/coordinator/review/30303030-3030-3030-3030-303030303030', '{"complaint_id": "30303030-3030-3030-3030-303030303030"}', false, NOW() - INTERVAL '15 hours');

-- Mixed Complaint 4
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '40404040-4040-4040-4040-404040404040',
  'b9ffacfb-eaa3-4128-8785-9811cffb72c8',
  'Public Wi-Fi Not Working',
  'Technology',
  'Internet',
  'Free public Wi-Fi in plaza not functioning.',
  'Town Plaza',
  14.6007, 120.9850,
  'pending review',
  'new',
  'low',
  NOW() - INTERVAL '11 hours',
  NOW() - INTERVAL '11 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('b9ffacfb-eaa3-4128-8785-9811cffb72c8', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Public Wi-Fi Not Working" has been received and is being reviewed.', '✅', '/citizen/complaints/40404040-4040-4040-4040-404040404040', '{"complaint_id": "40404040-4040-4040-4040-404040404040"}', false, NOW() - INTERVAL '11 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Public Wi-Fi Not Working" needs your review and assignment.', '📋', '/coordinator/review/40404040-4040-4040-4040-404040404040', '{"complaint_id": "40404040-4040-4040-4040-404040404040"}', false, NOW() - INTERVAL '11 hours');

-- Mixed Complaint 5
INSERT INTO public.complaints (
  id, submitted_by, title, type, subtype, descriptive_su, location_text,
  latitude, longitude, status, workflow_status, priority, submitted_at, updated_at
) VALUES (
  '50505050-5050-5050-5050-505050505050',
  'dc3a8b92-6518-40c8-9102-11b935dc6a5a',
  'Community Center AC Broken',
  'Facilities',
  'Maintenance',
  'Air conditioning in community center not working during hot weather.',
  'Community Center, Main Hall',
  14.5998, 120.9842,
  'pending review',
  'new',
  'medium',
  NOW() - INTERVAL '13 hours',
  NOW() - INTERVAL '13 hours'
);

INSERT INTO public.notification (user_id, type, priority, title, message, icon, link, metadata, read, created_at) VALUES
('dc3a8b92-6518-40c8-9102-11b935dc6a5a', 'complaint_submitted', 'info', 'Complaint Submitted', 'Your complaint "Community Center AC Broken" has been received and is being reviewed.', '✅', '/citizen/complaints/50505050-5050-5050-5050-505050505050', '{"complaint_id": "50505050-5050-5050-5050-505050505050"}', false, NOW() - INTERVAL '13 hours'),
('37b260b0-141f-4609-b6e3-77e103ada3e9', 'new_complaint_review', 'info', 'New Complaint for Review', '"Community Center AC Broken" needs your review and assignment.', '📋', '/coordinator/review/50505050-5050-5050-5050-505050505050', '{"complaint_id": "50505050-5050-5050-5050-505050505050"}', false, NOW() - INTERVAL '13 hours');

-- ============================================================================
-- Summary
-- ============================================================================
-- Total: 20 Complaints
-- WST Department: 5 (3 assigned to officer, 2 completed)
-- Unassigned (pending coordinator review): 10
-- Other departments (unassigned): 5
-- Total Notifications: ~60 (citizens, coordinator, admin, officers)


