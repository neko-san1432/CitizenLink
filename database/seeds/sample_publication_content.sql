-- Sample publication content (no images) with long descriptions
-- Run this against your database to populate demo content

-- NEWS (published)
INSERT INTO public.news (id, title, content, excerpt, category, tags, status, published_at)
VALUES
  (gen_random_uuid(), 'City launches new waste program',
   'The City Government hereby announces a comprehensive waste segregation and recycling program. The initiative covers phased rollouts per barangay, door-to-door education drives, and weekly checkpoints. Residents will receive guidance on dry and wet segregation, household composting, and proper disposal of special waste. The policy emphasizes community cooperation, measurable targets, and transparent reporting. It further details how schedules, hotlines, and barangay helpdesks can be accessed for clarifications and feedback. This long description is intended to simulate real-world editorial content with multiple paragraphs.\n\nKey components include: baseline surveys, service-level goals, training for collectors, and improved monitoring through periodic audits. The city invites volunteers and barangay youth leaders to support the information campaign.',
   'Segregation and recycling drive citywide.', 'SWM', ARRAY['policy','environment'], 'published', now() - interval '2 days'),

  (gen_random_uuid(), 'Road repairs scheduled along Main Avenue',
   'Engineering teams will conduct sectional milling and overlay across Main Avenue. Detours and one-way schemes will be implemented during work periods. The plan prioritizes safety, signage, and minimal disruption to businesses. Merchants and transport groups have been consulted to refine the timing and sequencing of works. The city reminds motorists to follow posted advisories and to allot additional travel time. This long-form update provides realistic text volume to test layout spacing and wrapping.',
   'Repairs along Main Ave for two weeks.', 'ENG', ARRAY['roads','maintenance'], 'published', now() - interval '5 days'),

  (gen_random_uuid(), 'Expanded health services in barangay clinics',
   'The City Health Office is scaling up barangay-based consultation schedules, vaccination posts, and maternal services. The article details clinic hours per district, mobile team rotations, and a hotline for urgent coordination. Residents are advised to bring IDs and previous medical records. The content is intentionally verbose to test typography and readability at length.',
   'More services at barangay clinics.', 'HEALTH', ARRAY['health','clinics'], 'published', now() - interval '8 days');

-- NOTICES (active)
INSERT INTO public.notices (id, title, content, priority, type, status, valid_from)
VALUES
  (gen_random_uuid(), 'Water Service Interruption',
   'Maintenance on the primary line will require a temporary shutdown. Affected areas include portions of Barangays A, B, and C. Water tankers will be deployed at designated streets. Residents are advised to store water and keep valves closed during the interruption. This long notice provides sufficient text to exercise the UI.',
   'urgent', 'ENG', 'active', now()),

  (gen_random_uuid(), 'Public Consultation on Zoning Updates',
   'A citywide public consultation is scheduled to gather inputs on proposed zoning adjustments. The session will explain impacts on building heights, heritage zones, and traffic demand management. Stakeholders are encouraged to attend and submit written comments. This lengthy content tests list wrapping and truncation in the sidebar.',
   'normal', 'PLANNING', 'active', now() - interval '1 day');

-- EVENTS (upcoming)
INSERT INTO public.events (id, title, description, location, event_date, organizer, status)
VALUES
  (gen_random_uuid(), 'Health Fair at Plaza',
   'Free medical checkups, vaccination updates, and health education booths will be set up at the city plaza. Long description to test the article panel sizing and copy flow. Clinics and NGOs will join the outreach, offering counseling and referrals.',
   'City Plaza', now() + interval '10 days', 'HEALTH', 'upcoming'),

  (gen_random_uuid(), 'Job Fair 2025',
   'Local and regional employers will conduct screening and interviews for open positions across multiple sectors. Attendees should bring identification, printed resumes, and certificates if available. The event guide includes booths, talk schedules, and assistance desks.',
   'City Hall Grounds', now() + interval '18 days', 'HR', 'upcoming');










