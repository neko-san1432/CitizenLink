-- Sync taxonomy v4.0.0 into database tables used by CitizenLink NLP management.
-- This migration is idempotent and safe to run multiple times.
-- Targets:
-- - public.nlp_category_config (top-level categories)
-- - public.nlp_keywords (normalize moved/renamed subcategories)
--
-- Notes:
-- - We keep legacy labels (e.g., "Traffic Jam") in DB if they exist, but
--   normalize keyword rows to the new canonical subcategory labels so UI
--   doesn't reintroduce deprecated names.
--
-- ============================================================================
-- 1) Ensure top-level categories exist / updated
-- ============================================================================
INSERT INTO public.nlp_category_config (category, parent_category, urgency_rating, description)
VALUES
  ('Emergency', NULL, 100, 'Emergency situations requiring immediate response'),
  ('Public Safety', NULL, 85, 'Safety, crime, and security concerns requiring enforcement or immediate response'),
  ('Environment', NULL, 80, 'Environmental and weather-related issues affecting public safety'),
  ('Utilities', NULL, 65, 'Essential services including water, electricity, and telecommunications'),
  ('Health Hazard', NULL, 70, 'Public health hazards and disease risks affecting community welfare'),
  ('Infrastructure', NULL, 55, 'Physical structures and facilities requiring maintenance or repair'),
  ('Traffic', NULL, 45, 'Traffic, road obstructions, and transportation disruptions'),
  ('Sanitation', NULL, 40, 'Waste management, sanitation, sewage, and cleanliness issues'),
  ('Pest Infestation', NULL, 45, 'Animal-related incidents and pest infestations (vector risks, stray animals, infestations)'),
  ('Noise', NULL, 25, 'Noise-related complaints and disturbances'),
  ('Others', NULL, 10, 'Miscellaneous complaints not fitting other categories')
ON CONFLICT (category) DO UPDATE
SET
  parent_category = EXCLUDED.parent_category,
  urgency_rating = EXCLUDED.urgency_rating,
  description = EXCLUDED.description;

-- Ensure canonical subcategory labels exist as categories where your DB uses
-- nlp_category_config as a taxonomy list (some deployments store subcategories here).
INSERT INTO public.nlp_category_config (category, parent_category, urgency_rating, description)
VALUES
  ('Traffic Congestion', 'Traffic', 45, 'Traffic jams, congestion, and signal/parking related flow issues'),
  ('Road Construction', 'Traffic', 40, 'Road work and construction-related disruption'),
  ('Fallen Tree', 'Traffic', 60, 'Fallen tree causing obstruction or hazard'),
  ('Clogged Drainage', 'Infrastructure', 55, 'Blocked canals/drainage causing flooding risk'),
  ('General Infestation', 'Pest Infestation', 35, 'Unspecified pest infestation'),
  ('Mosquito Breeding', 'Pest Infestation', 40, 'Mosquito breeding sites / vector risk'),
  ('Rodent Infestation', 'Pest Infestation', 35, 'Rodent infestation / rats'),
  ('Termite Infestation', 'Pest Infestation', 30, 'Termite infestation'),
  ('Animal Control', 'Pest Infestation', 45, 'Animal control / stray animals concerns'),
  ('Snake Sighting', 'Pest Infestation', 55, 'Snake sighting in community'),
  ('Disease Outbreak', 'Health Hazard', 70, 'Community disease outbreak concern')
ON CONFLICT (category) DO UPDATE
SET
  parent_category = EXCLUDED.parent_category,
  urgency_rating = EXCLUDED.urgency_rating,
  description = EXCLUDED.description;

-- ============================================================================
-- 2) Normalize keyword rows to canonical labels (prevents UI drift)
-- ============================================================================

-- Flood label normalization: keep Flooding canonical for environment issues
UPDATE public.nlp_keywords
SET subcategory = 'Flooding'
WHERE subcategory = 'Flood';

-- Traffic normalization
UPDATE public.nlp_keywords
SET subcategory = 'Traffic Congestion'
WHERE subcategory IN ('Traffic Jam', 'Congestion');

UPDATE public.nlp_keywords
SET subcategory = 'Road Construction'
WHERE subcategory = 'Construction';

-- Drainage normalization
UPDATE public.nlp_keywords
SET category = 'Infrastructure', subcategory = 'Clogged Drainage'
WHERE subcategory IN ('Clogged Canal', 'Clogged Drainage');

-- Animals & pests moved to Pest Infestation
UPDATE public.nlp_keywords
SET category = 'Pest Infestation'
WHERE category = 'Public Safety' AND subcategory IN ('Stray Dog', 'Animal Control', 'Snake Sighting');

UPDATE public.nlp_keywords
SET category = 'Pest Infestation'
WHERE category = 'Health Hazard' AND subcategory = 'Mosquito Breeding';

UPDATE public.nlp_keywords
SET category = 'Pest Infestation', subcategory = 'General Infestation'
WHERE category = 'Sanitation' AND subcategory = 'Pest Infestation';

-- Garbage is treated as Trash (canonical)
UPDATE public.nlp_keywords
SET subcategory = 'Trash'
WHERE subcategory = 'Garbage';

