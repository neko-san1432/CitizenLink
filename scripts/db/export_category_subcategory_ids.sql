-- citizenlink - Export category/subcategory IDs for seeding
-- Based on schema in src/db/dbFormat.sql
-- Includes:
--   1) categories table fields
--   2) subcategories table fields
--   3) joined category->subcategory mapping

-- =========================================================
-- 1) Categories (source of category_id)
-- =========================================================
SELECT
  c.id AS category_id,
  c.name AS category_name,
  c.code AS category_code,
  c.description AS category_description,
  c.icon AS category_icon,
  c.sort_order AS category_sort_order,
  c.is_active AS category_is_active,
  c.created_at AS category_created_at,
  c.updated_at AS category_updated_at
FROM public.categories c
ORDER BY c.sort_order ASC, c.name ASC;

-- =========================================================
-- 2) Subcategories (source of subcategory_id)
-- =========================================================
SELECT
  s.id AS subcategory_id,
  s.category_id,
  s.name AS subcategory_name,
  s.code AS subcategory_code,
  s.description AS subcategory_description,
  s.sort_order AS subcategory_sort_order,
  s.is_active AS subcategory_is_active,
  s.created_at AS subcategory_created_at,
  s.updated_at AS subcategory_updated_at
FROM public.subcategories s
ORDER BY s.category_id ASC, s.sort_order ASC, s.name ASC;

-- =========================================================
-- 3) Joined mapping (best for seed reference)
-- =========================================================
SELECT
  c.id AS category_id,
  c.name AS category_name,
  c.code AS category_code,
  s.id AS subcategory_id,
  s.name AS subcategory_name,
  s.code AS subcategory_code,
  c.is_active AS category_is_active,
  s.is_active AS subcategory_is_active
FROM public.categories c
LEFT JOIN public.subcategories s
  ON s.category_id = c.id
ORDER BY c.sort_order ASC, c.name ASC, s.sort_order ASC, s.name ASC;
