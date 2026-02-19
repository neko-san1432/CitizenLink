-- Remove subcategory column from complaints table
ALTER TABLE complaints DROP COLUMN IF EXISTS subcategory;
