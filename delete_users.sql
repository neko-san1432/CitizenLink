-- ============================================
-- SQL Script to Delete Users by Email
-- ============================================
-- WARNING: This will permanently delete users and their related data
-- Run this script with caution and ensure you have backups
-- 
-- Users to delete:
-- - pyrrhuselcidgo@gmail.com
-- - gopyrrhus@g.cjc.edu.ph
-- ============================================

-- Step 1: First, let's see the user IDs we're about to delete (for verification)
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'status' as status
FROM auth.users
WHERE email IN ('pyrrhuselcidgo@gmail.com', 'gopyrrhus@g.cjc.edu.ph');

-- Step 2: Store the user IDs in variables (for use in subsequent queries)
-- Note: In Supabase SQL Editor, you may need to use DO blocks or CTEs
DO $$
DECLARE
    user_id_1 uuid;
    user_id_2 uuid;
BEGIN
    -- Get user IDs
    SELECT id INTO user_id_1 FROM auth.users WHERE email = 'pyrrhuselcidgo@gmail.com';
    SELECT id INTO user_id_2 FROM auth.users WHERE email = 'gopyrrhus@g.cjc.edu.ph';
    
    -- If you want to delete related data first, uncomment these sections:
    
    -- Delete from audit_logs
    DELETE FROM public.audit_logs WHERE performed_by = user_id_1 OR performed_by = user_id_2;
    
    -- Delete from complaint_coordinators
    DELETE FROM public.complaint_coordinators WHERE user_id = user_id_1 OR user_id = user_id_2;
    DELETE FROM public.complaint_coordinators WHERE created_by = user_id_1 OR created_by = user_id_2;
    
    -- Delete from complaint_duplicates
    DELETE FROM public.complaint_duplicates WHERE merged_by = user_id_1 OR merged_by = user_id_2;
    
    -- Delete from complaint_evidence
    DELETE FROM public.complaint_evidence WHERE uploaded_by = user_id_1 OR uploaded_by = user_id_2;
    
    -- Delete from complaint_workflow_logs
    DELETE FROM public.complaint_workflow_logs WHERE action_by = user_id_1 OR action_by = user_id_2;
    
    -- Delete from complaints (if user submitted them)
    -- WARNING: This will delete all complaints submitted by these users
    -- DELETE FROM public.complaints WHERE submitted_by = user_id_1 OR submitted_by = user_id_2;
    -- Or reassign to another user:
    -- UPDATE public.complaints SET submitted_by = NULL WHERE submitted_by = user_id_1 OR submitted_by = user_id_2;
    
    -- Delete from role_changes
    DELETE FROM public.role_changes WHERE user_id = user_id_1 OR user_id = user_id_2;
    
    -- Delete from notification
    DELETE FROM public.notification WHERE user_id = user_id_1 OR user_id = user_id_2;
    
    -- Delete from signup_links (if they created any)
    -- Note: Check if this table exists and has user_id column
    -- DELETE FROM public.signup_links WHERE created_by = user_id_1 OR created_by = user_id_2;
    
    -- Finally, delete from auth.users
    -- This should cascade delete related records if CASCADE is set up
    DELETE FROM auth.users WHERE email IN ('pyrrhuselcidgo@gmail.com', 'gopyrrhus@g.cjc.edu.ph');
    
    RAISE NOTICE 'Users deleted successfully';
END $$;

-- ============================================
-- ALTERNATIVE: Simpler version (if CASCADE is set up)
-- ============================================
-- If foreign key constraints are set to CASCADE, you can just run:
-- DELETE FROM auth.users WHERE email IN ('pyrrhuselcidgo@gmail.com', 'gopyrrhus@g.cjc.edu.ph');

-- ============================================
-- VERIFICATION: Check if users were deleted
-- ============================================
SELECT 
    id,
    email,
    created_at
FROM auth.users
WHERE email IN ('pyrrhuselcidgo@gmail.com', 'gopyrrhus@g.cjc.edu.ph');
-- Should return 0 rows if successful


