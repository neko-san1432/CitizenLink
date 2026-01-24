-- Auto-generated seed file
-- Generated at 2026-01-24T19:27:50.277Z

BEGIN;

--------------------------------------------------------------------------------
-- 1. CATEGORIES & SUBCATEGORIES
--------------------------------------------------------------------------------

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Infrastructure', 'INFRASTRUCTURE', 'Physical structures and facilities requiring maintenance or repair', true, 45)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Pothole', 'POTHOLE', true, 1
FROM categories WHERE code = 'INFRASTRUCTURE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'INFRASTRUCTURE' AND s.name = 'Pothole'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Road Damage', 'ROAD_DAMAGE', true, 2
FROM categories WHERE code = 'INFRASTRUCTURE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'INFRASTRUCTURE' AND s.name = 'Road Damage'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Bridge Collapse', 'BRIDGE_COLLAPSE', true, 3
FROM categories WHERE code = 'INFRASTRUCTURE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'INFRASTRUCTURE' AND s.name = 'Bridge Collapse'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Broken Streetlight', 'BROKEN_STREETLIGHT', true, 4
FROM categories WHERE code = 'INFRASTRUCTURE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'INFRASTRUCTURE' AND s.name = 'Broken Streetlight'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Streetlight', 'STREETLIGHT', true, 5
FROM categories WHERE code = 'INFRASTRUCTURE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'INFRASTRUCTURE' AND s.name = 'Streetlight'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Sidewalk', 'SIDEWALK', true, 6
FROM categories WHERE code = 'INFRASTRUCTURE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'INFRASTRUCTURE' AND s.name = 'Sidewalk'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Building Collapse', 'BUILDING_COLLAPSE', true, 7
FROM categories WHERE code = 'INFRASTRUCTURE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'INFRASTRUCTURE' AND s.name = 'Building Collapse'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Illegal Construction', 'ILLEGAL_CONSTRUCTION', true, 8
FROM categories WHERE code = 'INFRASTRUCTURE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'INFRASTRUCTURE' AND s.name = 'Illegal Construction'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Infrastructure', 45)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Utilities', 'UTILITIES', 'Essential services including water, electricity, and telecommunications', true, 65)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'No Water', 'NO_WATER', true, 1
FROM categories WHERE code = 'UTILITIES'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'UTILITIES' AND s.name = 'No Water'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Blackout', 'BLACKOUT', true, 2
FROM categories WHERE code = 'UTILITIES'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'UTILITIES' AND s.name = 'Blackout'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Pipe Leak', 'PIPE_LEAK', true, 3
FROM categories WHERE code = 'UTILITIES'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'UTILITIES' AND s.name = 'Pipe Leak'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Low Pressure', 'LOW_PRESSURE', true, 4
FROM categories WHERE code = 'UTILITIES'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'UTILITIES' AND s.name = 'Low Pressure'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Power Line Down', 'POWER_LINE_DOWN', true, 5
FROM categories WHERE code = 'UTILITIES'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'UTILITIES' AND s.name = 'Power Line Down'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Transformer Explosion', 'TRANSFORMER_EXPLOSION', true, 6
FROM categories WHERE code = 'UTILITIES'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'UTILITIES' AND s.name = 'Transformer Explosion'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Utilities', 65)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Environment', 'ENVIRONMENT', 'Environmental and weather-related issues affecting public safety', true, 85)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Flooding', 'FLOODING', true, 1
FROM categories WHERE code = 'ENVIRONMENT'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'ENVIRONMENT' AND s.name = 'Flooding'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Flood', 'FLOOD', true, 2
FROM categories WHERE code = 'ENVIRONMENT'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'ENVIRONMENT' AND s.name = 'Flood'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Flash Flood', 'FLASH_FLOOD', true, 3
FROM categories WHERE code = 'ENVIRONMENT'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'ENVIRONMENT' AND s.name = 'Flash Flood'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Storm Surge', 'STORM_SURGE', true, 4
FROM categories WHERE code = 'ENVIRONMENT'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'ENVIRONMENT' AND s.name = 'Storm Surge'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Landslide', 'LANDSLIDE', true, 5
FROM categories WHERE code = 'ENVIRONMENT'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'ENVIRONMENT' AND s.name = 'Landslide'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Air Pollution', 'AIR_POLLUTION', true, 6
FROM categories WHERE code = 'ENVIRONMENT'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'ENVIRONMENT' AND s.name = 'Air Pollution'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Water Pollution', 'WATER_POLLUTION', true, 7
FROM categories WHERE code = 'ENVIRONMENT'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'ENVIRONMENT' AND s.name = 'Water Pollution'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Heavy Rain', 'HEAVY_RAIN', true, 8
FROM categories WHERE code = 'ENVIRONMENT'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'ENVIRONMENT' AND s.name = 'Heavy Rain'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Environment', 85)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Public Safety', 'PUBLIC_SAFETY', 'Safety and security concerns requiring immediate response', true, 88)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Crime', 'CRIME', true, 1
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Crime'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Theft', 'THEFT', true, 2
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Theft'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Robbery', 'ROBBERY', true, 3
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Robbery'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Holdup', 'HOLDUP', true, 4
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Holdup'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Harassment', 'HARASSMENT', true, 5
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Harassment'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Accident', 'ACCIDENT', true, 6
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Accident'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Stray Dog', 'STRAY_DOG', true, 7
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Stray Dog'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Animal Control', 'ANIMAL_CONTROL', true, 8
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Animal Control'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Snake Sighting', 'SNAKE_SIGHTING', true, 9
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Snake Sighting'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Reckless Driving', 'RECKLESS_DRIVING', true, 10
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Reckless Driving'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Drunk Driving', 'DRUNK_DRIVING', true, 11
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Drunk Driving'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Vandalism', 'VANDALISM', true, 12
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Vandalism'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Drug Activity', 'DRUG_ACTIVITY', true, 13
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Drug Activity'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Gunshot', 'GUNSHOT', true, 14
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Gunshot'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Assault', 'ASSAULT', true, 15
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Assault'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Trespassing', 'TRESPASSING', true, 16
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Trespassing'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Loitering', 'LOITERING', true, 17
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Loitering'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Gang Activity', 'GANG_ACTIVITY', true, 18
FROM categories WHERE code = 'PUBLIC_SAFETY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'PUBLIC_SAFETY' AND s.name = 'Gang Activity'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Public Safety', 88)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Sanitation', 'SANITATION', 'Waste management and cleanliness issues', true, 30)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Trash', 'TRASH', true, 1
FROM categories WHERE code = 'SANITATION'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'SANITATION' AND s.name = 'Trash'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Garbage', 'GARBAGE', true, 2
FROM categories WHERE code = 'SANITATION'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'SANITATION' AND s.name = 'Garbage'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Illegal Dumping', 'ILLEGAL_DUMPING', true, 3
FROM categories WHERE code = 'SANITATION'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'SANITATION' AND s.name = 'Illegal Dumping'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Overflowing Trash', 'OVERFLOWING_TRASH', true, 4
FROM categories WHERE code = 'SANITATION'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'SANITATION' AND s.name = 'Overflowing Trash'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Bad Odor', 'BAD_ODOR', true, 5
FROM categories WHERE code = 'SANITATION'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'SANITATION' AND s.name = 'Bad Odor'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Dead Animal', 'DEAD_ANIMAL', true, 6
FROM categories WHERE code = 'SANITATION'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'SANITATION' AND s.name = 'Dead Animal'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Sewage Leak', 'SEWAGE_LEAK', true, 7
FROM categories WHERE code = 'SANITATION'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'SANITATION' AND s.name = 'Sewage Leak'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Pest Infestation', 'PEST_INFESTATION', true, 8
FROM categories WHERE code = 'SANITATION'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'SANITATION' AND s.name = 'Pest Infestation'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Sanitation', 30)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Traffic', 'TRAFFIC', 'Traffic and transportation related issues', true, 50)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Road Obstruction', 'ROAD_OBSTRUCTION', true, 1
FROM categories WHERE code = 'TRAFFIC'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'TRAFFIC' AND s.name = 'Road Obstruction'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Traffic Jam', 'TRAFFIC_JAM', true, 2
FROM categories WHERE code = 'TRAFFIC'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'TRAFFIC' AND s.name = 'Traffic Jam'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Congestion', 'CONGESTION', true, 3
FROM categories WHERE code = 'TRAFFIC'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'TRAFFIC' AND s.name = 'Congestion'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Vehicle Breakdown', 'VEHICLE_BREAKDOWN', true, 4
FROM categories WHERE code = 'TRAFFIC'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'TRAFFIC' AND s.name = 'Vehicle Breakdown'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Construction', 'CONSTRUCTION', true, 5
FROM categories WHERE code = 'TRAFFIC'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'TRAFFIC' AND s.name = 'Construction'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Traffic', 50)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Health Hazard', 'HEALTH_HAZARD', 'Health and medical concerns affecting public welfare', true, 75)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Smoke', 'SMOKE', true, 1
FROM categories WHERE code = 'HEALTH_HAZARD'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'HEALTH_HAZARD' AND s.name = 'Smoke'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Mosquito Breeding', 'MOSQUITO_BREEDING', true, 2
FROM categories WHERE code = 'HEALTH_HAZARD'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'HEALTH_HAZARD' AND s.name = 'Mosquito Breeding'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Dengue', 'DENGUE', true, 3
FROM categories WHERE code = 'HEALTH_HAZARD'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'HEALTH_HAZARD' AND s.name = 'Dengue'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Stagnant Water', 'STAGNANT_WATER', true, 4
FROM categories WHERE code = 'HEALTH_HAZARD'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'HEALTH_HAZARD' AND s.name = 'Stagnant Water'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Health Hazard', 75)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Emergency', 'EMERGENCY', 'Emergency situations requiring immediate response', true, 100)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Fire', 'FIRE', true, 1
FROM categories WHERE code = 'EMERGENCY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'EMERGENCY' AND s.name = 'Fire'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Explosion', 'EXPLOSION', true, 2
FROM categories WHERE code = 'EMERGENCY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'EMERGENCY' AND s.name = 'Explosion'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Gas Leak', 'GAS_LEAK', true, 3
FROM categories WHERE code = 'EMERGENCY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'EMERGENCY' AND s.name = 'Gas Leak'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Evacuation', 'EVACUATION', true, 4
FROM categories WHERE code = 'EMERGENCY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'EMERGENCY' AND s.name = 'Evacuation'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Rescue', 'RESCUE', true, 5
FROM categories WHERE code = 'EMERGENCY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'EMERGENCY' AND s.name = 'Rescue'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Earthquake', 'EARTHQUAKE', true, 6
FROM categories WHERE code = 'EMERGENCY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'EMERGENCY' AND s.name = 'Earthquake'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Medical Emergency', 'MEDICAL_EMERGENCY', true, 7
FROM categories WHERE code = 'EMERGENCY'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'EMERGENCY' AND s.name = 'Medical Emergency'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Emergency', 100)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Noise', 'NOISE', 'Noise-related complaints and disturbances', true, 25)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Noise Complaint', 'NOISE_COMPLAINT', true, 1
FROM categories WHERE code = 'NOISE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'NOISE' AND s.name = 'Noise Complaint'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Loud Music', 'LOUD_MUSIC', true, 2
FROM categories WHERE code = 'NOISE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'NOISE' AND s.name = 'Loud Music'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Loud Party', 'LOUD_PARTY', true, 3
FROM categories WHERE code = 'NOISE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'NOISE' AND s.name = 'Loud Party'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Karaoke', 'KARAOKE', true, 4
FROM categories WHERE code = 'NOISE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'NOISE' AND s.name = 'Karaoke'
);

INSERT INTO subcategories (category_id, name, code, is_active, sort_order)
SELECT id, 'Barking Dog', 'BARKING_DOG', true, 5
FROM categories WHERE code = 'NOISE'
AND NOT EXISTS (
    SELECT 1 FROM subcategories s 
    JOIN categories c ON s.category_id = c.id 
    WHERE c.code = 'NOISE' AND s.name = 'Barking Dog'
);

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Noise', 25)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

INSERT INTO categories (name, code, description, is_active, sort_order)
VALUES ('Others', 'OTHERS', 'Miscellaneous complaints not fitting other categories', true, 10)
ON CONFLICT (code) DO UPDATE SET 
name = EXCLUDED.name,
description = EXCLUDED.description,
sort_order = EXCLUDED.sort_order;

INSERT INTO nlp_category_config (category, urgency_rating)
VALUES ('Others', 10)
ON CONFLICT (category) DO UPDATE SET urgency_rating = EXCLUDED.urgency_rating;

--------------------------------------------------------------------------------
-- 2. NLP KEYWORDS
--------------------------------------------------------------------------------
-- Clear existing to avoid duplicates if re-running
TRUNCATE TABLE nlp_keywords;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lubak', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('malubak', 'Infrastructure', 'Pothole', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('butas', 'Infrastructure', 'Pothole', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pothole', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('potholes', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road damage', 'Infrastructure', 'Road Damage', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('damaged road', 'Infrastructure', 'Road Damage', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('broken road', 'Infrastructure', 'Road Damage', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('cracked road', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('cracked pavement', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road cracks', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pavement damage', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road is uneven', 'Infrastructure', 'Pothole', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('uneven road', 'Infrastructure', 'Pothole', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bumpy road', 'Infrastructure', 'Pothole', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('rough road', 'Infrastructure', 'Pothole', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('rough surface', 'Infrastructure', 'Pothole', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road surface damage', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road deterioration', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('worn out road', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('damaged asphalt', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('crumbling road', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('eroded road', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sunken road', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('depressed pavement', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('large pothole', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('deep pothole', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('massive pothole', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('huge hole in road', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dangerous pothole', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hazardous road', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('unsafe road conditions', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road needs repair', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road needs fixing', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bad road condition', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('poor road quality', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road maintenance needed', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road in bad shape', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hole in the road', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('butas sa daan', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may butas ang daan', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sira ang daan', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bangag diri', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nakita ko may lubak', 'Infrastructure', 'Pothole', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pothole sa gilid ng daan', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pothole sa daan', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may pothole', 'Infrastructure', 'Pothole', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('maliit ang daanan', 'Infrastructure', 'Infrastructure', 0.7)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('guho', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naguho', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nabutas', 'Infrastructure', 'Pothole', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sirang kalsada', 'Infrastructure', 'Road Damage', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('wasak ang daan', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lubog ang daan', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bali-bali ang daan', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('guba ang dalan', 'Infrastructure', 'Road Damage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nangabuak', 'Infrastructure', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('broken streetlight', 'Infrastructure', 'Broken Streetlight', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('streetlight not working', 'Infrastructure', 'Broken Streetlight', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('streetlight out', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('no streetlight', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dark street', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('poor lighting', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('inadequate lighting', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('streetlight malfunction', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('light pole broken', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('street lamp broken', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lights not working', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('area too dark', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('needs street lighting', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flickering light', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sirang street light', 'Infrastructure', 'Broken Streetlight', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hindi umi ilaw', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nakita akong sirang street light', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('walang ilaw', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('madilim', 'Infrastructure', 'Broken Streetlight', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('madilim dito', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('patay ang ilaw', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sira ang poste', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('busted ang ilaw', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kumukurap', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('paputol-putol ang ilaw', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('walay suga', 'Infrastructure', 'Broken Streetlight', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ngitngit diri', 'Infrastructure', 'Broken Streetlight', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('daan', 'Infrastructure', 'Infrastructure', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kalsada', 'Infrastructure', 'Infrastructure', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('daanan', 'Infrastructure', 'Infrastructure', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lansangan', 'Infrastructure', 'Infrastructure', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('highway', 'Infrastructure', 'Infrastructure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('national road', 'Infrastructure', 'Infrastructure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('barangay road', 'Infrastructure', 'Infrastructure', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('eskinita', 'Infrastructure', 'Infrastructure', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kalye', 'Infrastructure', 'Infrastructure', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tulay', 'Infrastructure', 'Infrastructure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('overpass', 'Infrastructure', 'Infrastructure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('underpass', 'Infrastructure', 'Infrastructure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sidewalk', 'Infrastructure', 'Infrastructure', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bangketa', 'Infrastructure', 'Infrastructure', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dalan', 'Infrastructure', 'Infrastructure', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('taytay', 'Infrastructure', 'Infrastructure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tulay', 'Infrastructure', 'Infrastructure', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sirang tulay', 'Infrastructure', 'Bridge Collapse', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('gumuho ang tulay', 'Infrastructure', 'Bridge Collapse', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mapanganib ang tulay', 'Infrastructure', 'Infrastructure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('luma na ang tulay', 'Infrastructure', 'Infrastructure', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('taytay', 'Infrastructure', 'Infrastructure', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naguba ang taytay', 'Infrastructure', 'Bridge Collapse', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('no water supply', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water shortage', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water outage', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('no running water', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dry tap', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dry faucet', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water cut off', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water service interrupted', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water supply cut', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water disruption', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('no water pressure', 'Utilities', 'Low Pressure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('weak water flow', 'Utilities', 'Low Pressure', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('low water pressure', 'Utilities', 'Low Pressure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('poor water pressure', 'Utilities', 'Low Pressure', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trickle of water', 'Utilities', 'Low Pressure', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('barely any water', 'Utilities', 'No Water', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water leak', 'Utilities', 'Pipe Leak', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('leaking pipe', 'Utilities', 'Pipe Leak', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('burst pipe', 'Utilities', 'Pipe Leak', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('broken pipe', 'Utilities', 'Pipe Leak', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pipe rupture', 'Utilities', 'Pipe Leak', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water main break', 'Utilities', 'Pipe Leak', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('walang tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('wala kaming tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('way tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('way tubig skwater', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nawalan ng tubig', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('once a week lang nagkaka tubig', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sa gabi lang may tubig', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mahina yung tubig', 'Utilities', 'Low Pressure', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mahina yung tubig sa umaga', 'Utilities', 'Low Pressure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('palaging nawawala yung tubig', 'Utilities', 'No Water', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di kami makapag laba', 'Utilities', 'No Water', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('gusto ko nang maligo', 'Utilities', 'No Water', 0.75)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di man lang maka inom', 'Utilities', 'No Water', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('subrag init', 'Utilities', 'No Water', 0.7)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('putol ang tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naputol ang tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('wala pa ring tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ilang araw na walang tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('matagal na walang tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('low pressure', 'Utilities', 'Low Pressure', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tumatagos ang tubig', 'Utilities', 'Pipe Leak', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may tulo sa tubo', 'Utilities', 'Pipe Leak', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pumutok ang tubo', 'Utilities', 'Pipe Leak', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('butas ang tubo', 'Utilities', 'Pipe Leak', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('gripo', 'Utilities', 'Utilities', 0.7)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bomba', 'Utilities', 'Utilities', 0.7)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('deep well', 'Utilities', 'Utilities', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('walay tubig', 'Utilities', 'No Water', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naputol ang gripo', 'Utilities', 'No Water', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('power outage', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('no power', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('no electricity', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('power cut', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('electricity cut', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('power failure', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('electrical outage', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lights out', 'Utilities', 'Blackout', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lost power', 'Utilities', 'Blackout', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('power interruption', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('electrical problem', 'Utilities', 'Blackout', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('transformer issue', 'Utilities', 'Transformer Explosion', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('power line down', 'Utilities', 'Power Line Down', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('electrical line down', 'Utilities', 'Power Line Down', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sparking wires', 'Utilities', 'Power Line Down', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('exposed wires', 'Utilities', 'Power Line Down', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dangerous wires', 'Utilities', 'Power Line Down', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('brownout', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('walang kuryente', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nawalan ng ilaw', 'Utilities', 'Blackout', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('blackout', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naputol ang kuryente', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('power interruption', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('rotating brownout', 'Utilities', 'Blackout', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('scheduled brownout', 'Utilities', 'Blackout', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nahulog ang linya', 'Utilities', 'Power Line Down', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naputol ang kawad', 'Utilities', 'Power Line Down', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sumabog ang transformer', 'Utilities', 'Transformer Explosion', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sparking', 'Utilities', 'Power Line Down', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('chicharon', 'Utilities', 'Transformer Explosion', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('walay kuryente', 'Utilities', 'Blackout', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('namatay ang kuryente', 'Utilities', 'Blackout', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trash', 'Sanitation', 'Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('garbage', 'Sanitation', 'Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('waste', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('litter', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('rubbish', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trash pile', 'Sanitation', 'Overflowing Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('garbage pile', 'Sanitation', 'Overflowing Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('uncollected garbage', 'Sanitation', 'Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trash not collected', 'Sanitation', 'Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('overflowing trash', 'Sanitation', 'Overflowing Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trash bin full', 'Sanitation', 'Overflowing Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dumpster overflowing', 'Sanitation', 'Overflowing Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('garbage scattered', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trash everywhere', 'Sanitation', 'Overflowing Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('littering', 'Sanitation', 'Illegal Dumping', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('illegal dumping', 'Sanitation', 'Illegal Dumping', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('waste dumping', 'Sanitation', 'Illegal Dumping', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('smelly garbage', 'Sanitation', 'Bad Odor', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('rotting trash', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('garbage odor', 'Sanitation', 'Bad Odor', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trash smell', 'Sanitation', 'Bad Odor', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('unsanitary conditions', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('health hazard', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('basura', 'Sanitation', 'Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('basura sa daan', 'Sanitation', 'Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('daming basura', 'Sanitation', 'Overflowing Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('marami basura', 'Sanitation', 'Overflowing Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tambak na yung basura', 'Sanitation', 'Overflowing Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('wla bang lilinis', 'Sanitation', 'Trash', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di nakuha ang basura', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di nakuha ang basura ng maayos', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may umaapaw na basura', 'Sanitation', 'Overflowing Trash', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di madaanan', 'Sanitation', 'Trash', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pati sa sidewalk', 'Sanitation', 'Trash', 0.7)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tapon ng basura', 'Sanitation', 'Illegal Dumping', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('illegal dumping', 'Sanitation', 'Illegal Dumping', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagtatapon ng basura', 'Sanitation', 'Illegal Dumping', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tapunan ng basura', 'Sanitation', 'Illegal Dumping', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hindi dinadaan ng truck', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('basurero', 'Sanitation', 'Trash', 0.7)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('garbage truck', 'Sanitation', 'Trash', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hugaw', 'Sanitation', 'Trash', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('basura sa kadalanan', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nabulok', 'Sanitation', 'Trash', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bulok na basura', 'Sanitation', 'Trash', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('baho', 'Sanitation', 'Bad Odor', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ambaho', 'Sanitation', 'Bad Odor', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('napaka baho', 'Sanitation', 'Bad Odor', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sobrang baho', 'Sanitation', 'Bad Odor', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ang sakita sa mata tingnan', 'Sanitation', 'Bad Odor', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mabaho', 'Sanitation', 'Bad Odor', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nangangamoy', 'Sanitation', 'Bad Odor', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('amoy patay', 'Sanitation', 'Dead Animal', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('amoy bulok', 'Sanitation', 'Bad Odor', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('amoy dumi', 'Sanitation', 'Bad Odor', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nakakasuya ang amoy', 'Sanitation', 'Bad Odor', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nakakahilo ang amoy', 'Sanitation', 'Bad Odor', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('baho kaayo', 'Sanitation', 'Bad Odor', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('makabaw', 'Sanitation', 'Bad Odor', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagbara yung drainage', 'Sanitation', 'Clogged Drainage', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('barado', 'Sanitation', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('wla na madaanan yung tubig', 'Sanitation', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('baradong canal', 'Sanitation', 'Clogged Canal', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('baradong imburnal', 'Sanitation', 'Clogged Drainage', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('umaapaw ang canal', 'Sanitation', 'Clogged Canal', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('puno na ang drainage', 'Sanitation', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di makalusot ang tubig', 'Sanitation', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('septic tank', 'Sanitation', 'Sewage Leak', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('umaapaw ang septic', 'Sanitation', 'Sewage Leak', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tumatae sa labas', 'Sanitation', 'Sewage Leak', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nabasag ang imburnal', 'Sanitation', 'Clogged Drainage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('daga', 'Sanitation', 'Pest Infestation', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('daga everywhere', 'Sanitation', 'Pest Infestation', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pinapasukan na', 'Sanitation', 'Pest Infestation', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ipis', 'Sanitation', 'Pest Infestation', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('langgam', 'Sanitation', 'Pest Infestation', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('peste', 'Sanitation', 'Pest Infestation', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lamok', 'Sanitation', 'Mosquito Breeding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('daming lamok', 'Sanitation', 'Mosquito Breeding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('breeding ground ng lamok', 'Sanitation', 'Mosquito Breeding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dengue', 'Sanitation', 'Dengue', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may dengue sa area', 'Sanitation', 'Dengue', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ilaga', 'Sanitation', 'Pest Infestation', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('uk-uk', 'Sanitation', 'Pest Infestation', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('baha', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flooded', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flooding', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('underwater', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('submerged', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water level rising', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('rising water', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flood water', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('knee deep', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('waist deep', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('chest deep', 'Environment', 'Flooding', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('neck deep', 'Environment', 'Flooding', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flash flood', 'Environment', 'Flooding', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('river overflow', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('overflowing', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('impassable', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('cant cross', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('water entering', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('house flooded', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('street flooded', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road flooded', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bumaha', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bumaha dito', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mataas ang baha', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('malalim na ang baha', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ang lalim nang baha', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('abot tuhod', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('abot tuhod na', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('abot bewang', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('abot leeg', 'Environment', 'Flooding', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pumapasok na sa bahay', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('baha walang tulay', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may dalang kahoy yung baha', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flash flood', 'Environment', 'Flooding', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('umaapaw ang ilog', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lumubog', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hindi na makatawid', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('stranded', 'Environment', 'Stranded', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nastranded', 'Environment', 'Stranded', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hindi makauwi', 'Environment', 'Stranded', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('binaha ang bahay', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('binaha', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tubig baha', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagbaha', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('baha kaayo', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lunop', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('permi lunop', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('permi gyud lunop', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nag lunop', 'Environment', 'Flooding', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mag lunop dayon', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('barado ang imburnal', 'Environment', 'Clogged Drainage', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('puno sa basura ang kanal', 'Environment', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dili na makadagan ang tubig', 'Environment', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('taas kaayo ang tubig', 'Environment', 'Flooding', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pag ulan kusog', 'Environment', 'Flooding', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ubos kaayo ang dalan', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('walay dalanan ang tubig', 'Environment', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagsapot na ang kanal', 'Environment', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('daghan basura sa kanal', 'Environment', 'Clogged Drainage', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('gamay ra ang agianan sa tubig', 'Environment', 'Clogged Drainage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mag overflow', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mabaw ra ang imburnal', 'Environment', 'Clogged Drainage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dili makaya sa imburnal', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagtubig', 'Environment', 'Flooding', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lubak ang daan diri', 'Environment', 'Road Damage', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('landslide', 'Environment', 'Landslide', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('gumuho', 'Environment', 'Landslide', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pagguho ng lupa', 'Environment', 'Landslide', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('natabunan', 'Environment', 'Landslide', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('erosion', 'Environment', 'Landslide', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagkalandslide', 'Environment', 'Landslide', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bumagsak na puno', 'Environment', 'Fallen Tree', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nabuwal na puno', 'Environment', 'Fallen Tree', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('puno sa daan', 'Environment', 'Fallen Tree', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tumumbang puno', 'Environment', 'Fallen Tree', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nabali ang puno', 'Environment', 'Fallen Tree', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('harang ang puno', 'Environment', 'Road Obstruction', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('traffic', 'Traffic', 'Traffic', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tumatraffic', 'Traffic', 'Traffic', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di maka daan', 'Traffic', 'Traffic', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di ako maka daan', 'Traffic', 'Traffic', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('di na maka daan', 'Traffic', 'Traffic', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hirap maka daan', 'Traffic', 'Traffic', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nakakasagabal', 'Traffic', 'Road Obstruction', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naka sagabal sa daan', 'Traffic', 'Road Obstruction', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trapik', 'Traffic', 'Traffic', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('traffic jam', 'Traffic', 'Traffic', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bumubuntot na sasakyan', 'Traffic', 'Traffic', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('masikip ang daan', 'Traffic', 'Traffic', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('harang sa daan', 'Traffic', 'Road Obstruction', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road closure', 'Traffic', 'Road Obstruction', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sarado ang daan', 'Traffic', 'Road Obstruction', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('aksidente', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('crash', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('crashed', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('collision', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('collided', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hit and run', 'Traffic', 'Accident', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('got hit', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('run over', 'Traffic', 'Accident', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ran over', 'Traffic', 'Accident', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('overturned', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flipped over', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('motorcycle accident', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('truck accident', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bus accident', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('traffic accident', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('road accident', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pedestrian hit', 'Traffic', 'Accident', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagkaaksidente', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nabangga', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagbangga', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagkabangaan', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nasagasaan', 'Traffic', 'Accident', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('vehicular accident', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('car accident', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('motor accident', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nadisgrasya', 'Traffic', 'Accident', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sumalpok', 'Traffic', 'Accident', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tumilapon', 'Traffic', 'Accident', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nadulas', 'Traffic', 'Accident', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naaksidente', 'Traffic', 'Accident', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nasira ang kotse', 'Traffic', 'Vehicle Breakdown', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('namatay ang makina', 'Traffic', 'Vehicle Breakdown', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('breakdown', 'Traffic', 'Vehicle Breakdown', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flat tire', 'Traffic', 'Vehicle Breakdown', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naflat', 'Traffic', 'Vehicle Breakdown', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('overheating', 'Traffic', 'Vehicle Breakdown', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sunog', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nasusunog', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may sunog', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nasunog', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('fire', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('house fire', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('building fire', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('burning', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('on fire', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('flames', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('blaze', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('blazing', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('inferno', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('wildfire', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('grass fire', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('forest fire', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('electrical fire', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('caught fire', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('fire broke out', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('fire spreading', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('smoke coming', 'Public Safety', 'Smoke', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('black smoke', 'Public Safety', 'Smoke', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('thick smoke', 'Public Safety', 'Smoke', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('smoke alarm', 'Public Safety', 'Fire', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('fire alarm', 'Public Safety', 'Fire', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('engulfed', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('burn down', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('burned down', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('usok', 'Public Safety', 'Smoke', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('maraming usok', 'Public Safety', 'Smoke', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('maitim na usok', 'Public Safety', 'Smoke', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagsisimula na ang apoy', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kumakalat ang apoy', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('apoy', 'Public Safety', 'Fire', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagliliyab', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kayo', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagkayo', 'Public Safety', 'Fire', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nasunog ang balay', 'Public Safety', 'Fire', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('aso', 'Public Safety', 'Stray Dog', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nakita ko ang aso', 'Public Safety', 'Stray Dog', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nakita akong aso sa daan', 'Public Safety', 'Stray Dog', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kinagat ako ng aso', 'Public Safety', 'Stray Dog', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('stray dog', 'Public Safety', 'Stray Dog', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('asong gala', 'Public Safety', 'Stray Dog', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('rabid dog', 'Public Safety', 'Stray Dog', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may rabies', 'Public Safety', 'Stray Dog', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagbabangis', 'Public Safety', 'Stray Dog', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagwawala ang aso', 'Public Safety', 'Stray Dog', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('halas', 'Public Safety', 'Snake Sighting', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ahas', 'Public Safety', 'Snake Sighting', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may ahas', 'Public Safety', 'Snake Sighting', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('iro', 'Public Safety', 'Stray Dog', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bitin', 'Public Safety', 'Snake Sighting', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('patay na hayop', 'Public Safety', 'Dead Animal', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bangkay ng aso', 'Public Safety', 'Dead Animal', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('maingay', 'Public Safety', 'Noise Complaint', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ang ingay', 'Public Safety', 'Noise Complaint', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ang iingay', 'Public Safety', 'Noise Complaint', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sobrang ingay', 'Public Safety', 'Noise Complaint', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sobrang ingay ng karaoke', 'Public Safety', 'Noise Complaint', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('karaoke', 'Public Safety', 'Noise Complaint', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('videoke', 'Public Safety', 'Noise Complaint', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('noise disturbance', 'Public Safety', 'Noise Complaint', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ingay ng kapitbahay', 'Public Safety', 'Noise Complaint', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tahol ng aso', 'Public Safety', 'Noise Complaint', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('music', 'Public Safety', 'Noise Complaint', 0.7)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('loud music', 'Public Safety', 'Noise Complaint', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('party', 'Public Safety', 'Noise Complaint', 0.7)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('iistorbo', 'Public Safety', 'Noise Complaint', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kasaba', 'Public Safety', 'Noise Complaint', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nakawan', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('theft', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('robbery', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('robbed', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('stolen', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('thief', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('burglar', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('burglary', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('break in', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('breaking in', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('assault', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('attacked', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('stabbed', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('stabbing', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('shot', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('shooting', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('gunshot', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('gunfire', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('armed', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mugging', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('mugged', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kidnapping', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hostage', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('suspicious person', 'Public Safety', 'Crime', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('intruder', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trespassing', 'Public Safety', 'Crime', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('drugs', 'Public Safety', 'Crime', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('drug dealing', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nanakawan', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may magnanakaw', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('holdup', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('holdaper', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('snatcher', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nasnatcher', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('riot', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('away', 'Public Safety', 'Crime', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nagkaaway', 'Public Safety', 'Crime', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('sinaksak', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('binaril', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('putukan', 'Public Safety', 'Crime', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may baril', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('droga', 'Public Safety', 'Crime', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('vandalism', 'Public Safety', 'Vandalism', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('pinandalize', 'Public Safety', 'Vandalism', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kawatan', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('tulisan', 'Public Safety', 'Crime', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('emergency', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('medical emergency', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('injured', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('injuries', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('wounded', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('bleeding', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('unconscious', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('not breathing', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('stopped breathing', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('fainted', 'Public Safety', 'Medical', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('passed out', 'Public Safety', 'Medical', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('collapsed', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('seizure', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('choking', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('chest pain', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('difficulty breathing', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('cant breathe', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('allergic reaction', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('overdose', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ambulance', 'Public Safety', 'Medical', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('paramedic', 'Public Safety', 'Medical', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('CPR', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('need help', 'Public Safety', 'Medical', 0.85)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('need medical', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('may sugatan', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nasugatan', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('dumudugo', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('nawalan ng malay', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('hinimatay', 'Public Safety', 'Medical', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('heart attack', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('atake sa puso', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('stroke', 'Public Safety', 'Medical', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ambulansya', 'Public Safety', 'Medical', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('ospital', 'Public Safety', 'Medical', 0.8)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kailangan ng tulong medikal', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('namatay', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('patay', 'Public Safety', 'Medical', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('evacuate', 'Public Safety', 'Evacuation', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('evacuation', 'Public Safety', 'Evacuation', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('lumikas', 'Public Safety', 'Evacuation', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('likas na', 'Public Safety', 'Evacuation', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('evacuees', 'Public Safety', 'Evacuation', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('evacuation center', 'Public Safety', 'Evacuation', 0.9)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('kailangan ng rescue', 'Public Safety', 'Rescue', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('rescue', 'Public Safety', 'Rescue', 0.98)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('trapped', 'Public Safety', 'Rescue', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;
INSERT INTO nlp_keywords (term, category, subcategory, confidence) 
VALUES ('naiipit', 'Public Safety', 'Rescue', 0.95)
ON CONFLICT (term) DO UPDATE SET 
category = EXCLUDED.category, 
subcategory = EXCLUDED.subcategory,
confidence = EXCLUDED.confidence;

--------------------------------------------------------------------------------
-- 3. METAPHORS
--------------------------------------------------------------------------------
TRUNCATE TABLE nlp_metaphors;
INSERT INTO nlp_metaphors (pattern) VALUES ('parang moon crater') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('cat''s piss|cats piss') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('water bender') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('crystalmaiden|crystal maiden') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('my lambo') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('hihintayin.*mamatay sa uhaw') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('parang swimming pool') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('para akong nasa impyerno') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('mukha ng ilog') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('parang ilog na') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('parang bundok na ang basura') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('flood of students|flood of people|flood of customers') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('namatay ang phone|dead phone|patay ang phone') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('namatay ang internet|patay ang wifi') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('mamamatay na ako sa init') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('gutom na gutom na ako.*mamatay') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('parang dagat na|sama sa dagat') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('parang langit na|atong langit') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('mamatay ko sa init|mamatay sa kainit') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('patay na akong phone|namatay akong phone') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('sama sa swimming pool') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('lungag sama sa moon crater') ON CONFLICT DO NOTHING;
INSERT INTO nlp_metaphors (pattern) VALUES ('daghan kaayo sama sa bukid|parang bundok') ON CONFLICT DO NOTHING;

COMMIT;
