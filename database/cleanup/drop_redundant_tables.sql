-- Candidate redundant tables (review before executing)
-- This file only contains DROP statements commented out by default.
-- Un-comment the ones you confirm to be redundant in your deployment.

-- RATIONALE SUMMARY
-- 1) public.notice and public.upcomingEvents: Legacy/demo tables not referenced by code
-- 2) public.news: Out of scope if portal doesn't manage news articles  
-- 3) public.events: Out of scope if event management is not needed
-- 4) public.notices: UNUSED - system uses `public.notification` for in-app notifications
-- 5) public.notification: KEEP - This is the active notification system used by the app

-- NOTIFICATION TABLES CLARIFICATION:
-- - public.notification: ACTIVE - Used for user-specific in-app notifications, toast alerts
-- - public.notices: UNUSED - Appears to be legacy table for public announcements

-- NOTE: Verify with product requirements before dropping. Consider migrating data if still relevant.

-- BEGIN: Safe drops (commented)
-- DROP TABLE IF EXISTS public.notice CASCADE;               -- Legacy minimal table
-- DROP TABLE IF EXISTS public.upcomingEvents CASCADE;       -- Legacy demo table  
-- DROP TABLE IF EXISTS public.news CASCADE;                 -- If news publishing is out of scope
-- DROP TABLE IF EXISTS public.events CASCADE;               -- If event management is out of scope
-- DROP TABLE IF EXISTS public.notices CASCADE;              -- UNUSED - replaced by notification table
-- END

-- If you decide to drop, ensure dependent FKs or code references are removed.


