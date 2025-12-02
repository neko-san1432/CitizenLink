-- Script to list all existing RLS policies for CitizenLink tables

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM
    pg_policies
WHERE
    tablename IN ('complaints', 'complaint_evidence', 'complaint_assignments', 'complaint_reminders')
ORDER BY
    tablename, policyname;
