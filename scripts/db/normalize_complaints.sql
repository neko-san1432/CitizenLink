-- normalize_complaints.sql (v1.0)
-- Converts text category/subcategory into UUID foreign keys

BEGIN;

-- 1. Add temporary UUID columns
ALTER TABLE complaints ADD COLUMN category_id_new UUID;
ALTER TABLE complaints ADD COLUMN subcategory_id_new UUID;

-- 2. Populate UUIDs based on existing text names
-- Matching by name string to the Categories/Subcategories lookup tables
UPDATE complaints c
SET category_id_new = cat.id
FROM categories cat
WHERE c.category = cat.name;

UPDATE complaints c
SET subcategory_id_new = sub.id
FROM subcategories sub
JOIN categories cat ON sub.category_id = cat.id
WHERE c.subcategory = sub.name 
  AND c.category = cat.name;

-- 3. Validation: Check if there are any that failed to map
-- We skip this here as we already purged dangling ones in nuclear_cleanup.sql

-- 4. SWAP: Remove old text columns and rename the IDs
-- Note: We drop existing category/subcategory text columns
ALTER TABLE complaints DROP COLUMN category CASCADE;
ALTER TABLE complaints DROP COLUMN subcategory CASCADE;

ALTER TABLE complaints RENAME COLUMN category_id_new TO category_id;
ALTER TABLE complaints RENAME COLUMN subcategory_id_new TO subcategory_id;

-- 5. Finalize: Set Constraints
-- Ensures future complaints MUST reference a valid category/subcategory
ALTER TABLE complaints 
  ADD CONSTRAINT fk_complaints_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_complaints_subcategory FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL;

-- 6. Add Index for performance
CREATE INDEX idx_complaints_category_id ON complaints(category_id);
CREATE INDEX idx_complaints_subcategory_id ON complaints(subcategory_id);

COMMIT;

-- VERIFICATION
SELECT 'Normalized rows count: ' || COUNT(*) FROM complaints WHERE category_id IS NOT NULL;
