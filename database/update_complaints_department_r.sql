-- SQL Script to update department_r for 10 specific complaints
-- This script updates complaints by matching their titles
-- Run this script after inserting complaints from complaints_payload.sql
-- NOTE: This updates the department_r array field with random department codes

-- Update Complaint 1: Damaged Road Surface on Main Street
UPDATE public.complaints
SET 
  department_r = ARRAY['CEO', 'GSO'],
  updated_at = NOW()
WHERE title = 'Damaged Road Surface on Main Street'
  AND location_text = 'Main Street, near Oak Avenue intersection';

-- Update Complaint 5: Noisy Construction Work After Hours
UPDATE public.complaints
SET 
  department_r = ARRAY['CPDC', 'GSO'],
  updated_at = NOW()
WHERE title = 'Noisy Construction Work After Hours'
  AND location_text = 'Industrial Avenue, near Residential Area';

-- Update Complaint 10: Water Supply Interruption
UPDATE public.complaints
SET 
  department_r = ARRAY['WST'],
  updated_at = NOW()
WHERE title = 'Water Supply Interruption'
  AND location_text = 'Barangay San Juan, Subdivision Area';

-- Update Complaint 15: Missing Road Signs
UPDATE public.complaints
SET 
  department_r = ARRAY['CEO', 'CPDC'],
  updated_at = NOW()
WHERE title = 'Missing Road Signs'
  AND location_text = 'Intersection of Main Street and Highway Road';

-- Update Complaint 20: Unsafe Pedestrian Crossing
UPDATE public.complaints
SET 
  department_r = ARRAY['CEO', 'DEPED'],
  updated_at = NOW()
WHERE title = 'Unsafe Pedestrian Crossing'
  AND location_text = 'Near Elementary School, Main Road';

-- Update Complaint 25: Lack of Street Lighting
UPDATE public.complaints
SET 
  department_r = ARRAY['GSO'],
  updated_at = NOW()
WHERE title = 'Lack of Street Lighting'
  AND location_text = 'Barangay Santa Maria, Residential Streets';

-- Update Complaint 30: Illegal Dumping Site
UPDATE public.complaints
SET 
  department_r = ARRAY['GSO', 'CHO'],
  updated_at = NOW()
WHERE title = 'Illegal Dumping Site'
  AND location_text = 'Empty Lot, Barangay San Pedro';

-- Update Complaint 35: Lack of Wheelchair Accessibility
UPDATE public.complaints
SET 
  department_r = ARRAY['GSO', 'CSWDO'],
  updated_at = NOW()
WHERE title = 'Lack of Wheelchair Accessibility'
  AND location_text = 'Various Public Buildings';

-- Update Complaint 40: Water Quality Concerns
UPDATE public.complaints
SET 
  department_r = ARRAY['WST', 'CHO'],
  updated_at = NOW()
WHERE title = 'Water Quality Concerns'
  AND location_text = 'Barangay San Pedro, Residential Areas';

-- Update Complaint 45: Damaged Public Signage
UPDATE public.complaints
SET 
  department_r = ARRAY['GSO', 'CPDC'],
  updated_at = NOW()
WHERE title = 'Damaged Public Signage'
  AND location_text = 'Throughout Municipality';

-- Verification query (optional - uncomment to check results)
-- SELECT id, title, department_r, updated_at 
-- FROM public.complaints 
-- WHERE department_r IS NOT NULL AND array_length(department_r, 1) > 0
-- ORDER BY updated_at DESC;

