-- Drop Content Management Tables
-- Warning: This will permanently delete all news, events, and notices data
-- Date: 2025-10-17

-- Drop RLS policies first
DROP POLICY IF EXISTS "Public can view published news" ON public.news;
DROP POLICY IF EXISTS "Public can view upcoming and ongoing events" ON public.events;
DROP POLICY IF EXISTS "Public can view active notices" ON public.notices;
DROP POLICY IF EXISTS "Admins can manage news" ON public.news;
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Admins can manage notices" ON public.notices;

-- Drop indexes (will be dropped automatically with tables, but listing for clarity)
DROP INDEX IF EXISTS public.idx_news_status;
DROP INDEX IF EXISTS public.idx_news_published_at;
DROP INDEX IF EXISTS public.idx_news_category;
DROP INDEX IF EXISTS public.idx_events_status;
DROP INDEX IF EXISTS public.idx_events_event_date;
DROP INDEX IF EXISTS public.idx_events_category;
DROP INDEX IF EXISTS public.idx_notices_status;
DROP INDEX IF EXISTS public.idx_notices_priority;
DROP INDEX IF EXISTS public.idx_notices_valid_from;
DROP INDEX IF EXISTS public.idx_notices_valid_until;

-- Drop tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS public.news CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.notices CASCADE;

-- Confirmation message
SELECT 'Content management tables dropped successfully' AS status;
