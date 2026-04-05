-- citizenlink - Nuclear Cleanup Script (v2.0)
-- Purges corrupted complaints AND scrub lookup tables with UUID names

BEGIN;

-- ---------------------------------------------------------
-- PART 1: CLEAR CORRUPTED COMPLAINTS
-- ---------------------------------------------------------

-- 1a. Identify the specific target IDs (Precise scan)
CREATE TEMP TABLE temp_purge_complaint_ids AS
SELECT id FROM complaints 
WHERE 
  (category ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
   AND category NOT IN (SELECT id::text FROM categories))
OR 
  (subcategory ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
   AND subcategory NOT IN (SELECT id::text FROM subcategories));

-- 1b. Delete from all referencing tables in order of dependency
DELETE FROM complaint_assignments WHERE complaint_id IN (SELECT id FROM temp_purge_complaint_ids);
DELETE FROM complaint_history WHERE complaint_id IN (SELECT id FROM temp_purge_complaint_ids);
DELETE FROM complaint_evidence WHERE complaint_id IN (SELECT id FROM temp_purge_complaint_ids);
DELETE FROM complaint_reminders WHERE complaint_id IN (SELECT id FROM temp_purge_complaint_ids);
DELETE FROM complaint_workflow_logs WHERE complaint_id IN (SELECT id FROM temp_purge_complaint_ids);
DELETE FROM nlp_pending_reviews WHERE complaint_id IN (SELECT id FROM temp_purge_complaint_ids);
DELETE FROM complaint_similarities WHERE complaint_id IN (SELECT id FROM temp_purge_complaint_ids) OR similar_complaint_id IN (SELECT id FROM temp_purge_complaint_ids);
DELETE FROM complaint_duplicates WHERE master_complaint_id IN (SELECT id FROM temp_purge_complaint_ids) OR duplicate_complaint_id IN (SELECT id FROM temp_purge_complaint_ids);

-- 1c. Final purge of the dangling parent records
DELETE FROM complaints WHERE id IN (SELECT id FROM temp_purge_complaint_ids);

-- ---------------------------------------------------------
-- PART 2: SCRUB INVALID LOOKUP ENTRIES (UUID NAMES)
-- ---------------------------------------------------------

-- 2a. Identify lookup rows where name is a UUID string
CREATE TEMP TABLE temp_bad_cat_ids AS SELECT id FROM categories WHERE name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
CREATE TEMP TABLE temp_bad_sub_ids AS SELECT id FROM subcategories WHERE name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 2b. Delete mappings
DELETE FROM department_subcategory_mapping WHERE subcategory_id IN (SELECT id FROM temp_bad_sub_ids);

-- 2c. Delete subcategorieslinked to bad categories or having bad names
DELETE FROM subcategories WHERE category_id IN (SELECT id FROM temp_bad_cat_ids) OR id IN (SELECT id FROM temp_bad_sub_ids);

-- 2d. Delete categories
DELETE FROM categories WHERE id IN (SELECT id FROM temp_bad_cat_ids);

-- ---------------------------------------------------------
-- CLEANUP TEMP TABLES
-- ---------------------------------------------------------
DROP TABLE temp_purge_complaint_ids;
DROP TABLE temp_bad_cat_ids;
DROP TABLE temp_bad_sub_ids;

COMMIT;

-- FINAL VERIFICATION
SELECT 'Dangling Complaints: ' || COUNT(*) FROM complaints WHERE (category ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND category NOT IN (SELECT id::text FROM categories));
SELECT 'Invalid Categories: ' || COUNT(*) FROM categories WHERE name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
SELECT 'Invalid Subcategories: ' || COUNT(*) FROM subcategories WHERE name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
