-- SQL Script for Manually Updating complaint Status & Comments (JSON)
-- Usage: Replace 'YOUR_COMPLAINT_ID' and run in Supabase/SQL Editor

-- =========================================================
-- UPDATE: SET STATUS AND ADD COMMENT TO JSON
-- This uses the new 'comment' JSONB column as requested.
-- =========================================================

UPDATE public.complaints
SET 
  -- 1. Update the Status
  workflow_status = 'verified',   -- Options: submitted, verified, under_review, action_taken, resolved
  updated_at = NOW(),

  -- 2. Update the 'comment' JSON
  -- We use jsonb_set or || to merge the new phase data
  -- Structure: Phase Name (key) -> { date, comment }
  comment = comment || jsonb_build_object(
    'verified', jsonb_build_object(
      'date', NOW(),
      'comment', 'Verified and accepted by Officer Dave.'
    )
  )

WHERE id = 'YOUR_COMPLAINT_ID';


-- =========================================================
-- EXAMPLE: UPDATE TO "UNDER REVIEW"
-- =========================================================
/*
UPDATE public.complaints
SET 
  workflow_status = 'under_review',
  updated_at = NOW(),
  comment = comment || jsonb_build_object(
    'under_review', jsonb_build_object(
      'date', NOW(),
      'comment', 'Investigating valid evidence provided.'
    )
  )
WHERE id = 'YOUR_COMPLAINT_ID';
*/

-- =========================================================
-- EXAMPLE: UPDATE TO "ACTION TAKEN"
-- =========================================================
/*
UPDATE public.complaints
SET 
  workflow_status = 'action_taken',
  updated_at = NOW(),
  comment = comment || jsonb_build_object(
    'action_taken', jsonb_build_object(
      'date', NOW(),
      'comment', 'Deployed repair team to the site.'
    )
  )
WHERE id = 'YOUR_COMPLAINT_ID';
*/
