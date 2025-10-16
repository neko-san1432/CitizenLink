-- Cleanup complaints with empty department_r arrays
-- WARNING: This deletes data. Review and backup before running in production.

BEGIN;

-- Optional: preview rows to be deleted
-- SELECT id, title, department_r FROM public.complaints
-- WHERE department_r = '{}'::text[] OR array_length(department_r, 1) IS NULL;

DELETE FROM public.complaints
WHERE department_r = '{}'::text[]
   OR array_length(department_r, 1) IS NULL; -- treats NULL and empty as empty set

COMMIT;



