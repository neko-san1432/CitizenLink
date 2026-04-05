-- citizenlink - Delete Complaints With Null Category/Subcategory
-- Removes complaints where both category and subcategory are missing.
-- Compatible with either schema variant:
--   1) complaints.category + complaints.subcategory (text)
--   2) complaints.category_id + complaints.subcategory_id (uuid/fk)

BEGIN;

DO $$
DECLARE
  has_text_cols boolean;
  has_id_cols boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'category'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'subcategory'
  ) INTO has_text_cols;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'category_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'subcategory_id'
  ) INTO has_id_cols;

  CREATE TEMP TABLE temp_delete_complaint_ids (
    id uuid PRIMARY KEY
  ) ON COMMIT DROP;

  IF has_text_cols THEN
    EXECUTE '
      INSERT INTO temp_delete_complaint_ids (id)
      SELECT id
      FROM complaints
      WHERE NULLIF(BTRIM(category), '''') IS NULL
        AND NULLIF(BTRIM(subcategory), '''') IS NULL
      ON CONFLICT (id) DO NOTHING
    ';
  END IF;

  IF has_id_cols THEN
    EXECUTE '
      INSERT INTO temp_delete_complaint_ids (id)
      SELECT id
      FROM complaints
      WHERE category_id IS NULL
        AND subcategory_id IS NULL
      ON CONFLICT (id) DO NOTHING
    ';
  END IF;

  DELETE FROM complaint_assignments
  WHERE complaint_id IN (SELECT id FROM temp_delete_complaint_ids);

  DELETE FROM complaint_history
  WHERE complaint_id IN (SELECT id FROM temp_delete_complaint_ids);

  DELETE FROM complaint_evidence
  WHERE complaint_id IN (SELECT id FROM temp_delete_complaint_ids);

  DELETE FROM complaint_reminders
  WHERE complaint_id IN (SELECT id FROM temp_delete_complaint_ids);

  DELETE FROM complaint_workflow_logs
  WHERE complaint_id IN (SELECT id FROM temp_delete_complaint_ids);

  DELETE FROM nlp_pending_reviews
  WHERE complaint_id IN (SELECT id FROM temp_delete_complaint_ids);

  DELETE FROM complaint_similarities
  WHERE complaint_id IN (SELECT id FROM temp_delete_complaint_ids)
     OR similar_complaint_id IN (SELECT id FROM temp_delete_complaint_ids);

  DELETE FROM complaint_duplicates
  WHERE master_complaint_id IN (SELECT id FROM temp_delete_complaint_ids)
     OR duplicate_complaint_id IN (SELECT id FROM temp_delete_complaint_ids);

  DELETE FROM complaints
  WHERE id IN (SELECT id FROM temp_delete_complaint_ids);

  RAISE NOTICE 'Deleted complaints: %', (SELECT COUNT(*) FROM temp_delete_complaint_ids);

  DROP TABLE temp_delete_complaint_ids;
END $$;

COMMIT;
