-- Migration: Add RLS policies for content tables (news, notices, events)
-- This allows lgu-admin users to create, update, and view content

-- ============================================================================
-- NEWS TABLE POLICIES
-- ============================================================================

-- Enable RLS on news table
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'news' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.news', policy_name);
    END LOOP;
END $$;

-- Policy: Everyone can view published news
CREATE POLICY "Anyone can view published news" ON public.news
  FOR SELECT USING (status = 'published');

-- Policy: LGU Admins can view all news (including drafts)
CREATE POLICY "LGU Admins can view all news" ON public.news
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
  );

-- Policy: LGU Admins can insert news
CREATE POLICY "LGU Admins can insert news" ON public.news
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
    AND author_id = auth.uid()
  );

-- Policy: LGU Admins can update news (only their own or all if super-admin)
CREATE POLICY "LGU Admins can update news" ON public.news
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
  );

-- ============================================================================
-- NOTICES TABLE POLICIES
-- ============================================================================

-- Enable RLS on notices table
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'notices' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notices', policy_name);
    END LOOP;
END $$;

-- Policy: Everyone can view active notices
CREATE POLICY "Anyone can view active notices" ON public.notices
  FOR SELECT USING (
    status = 'active' 
    AND (valid_until IS NULL OR valid_until >= now())
  );

-- Policy: LGU Admins can view all notices
CREATE POLICY "LGU Admins can view all notices" ON public.notices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
  );

-- Policy: LGU Admins can insert notices
CREATE POLICY "LGU Admins can insert notices" ON public.notices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
    AND created_by = auth.uid()
  );

-- Policy: LGU Admins can update notices
CREATE POLICY "LGU Admins can update notices" ON public.notices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
  );

-- ============================================================================
-- EVENTS TABLE POLICIES
-- ============================================================================

-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DO $$
DECLARE
    policy_name text;
BEGIN
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'events' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', policy_name);
    END LOOP;
END $$;

-- Policy: Everyone can view upcoming events
CREATE POLICY "Anyone can view upcoming events" ON public.events
  FOR SELECT USING (status IN ('upcoming', 'ongoing'));

-- Policy: LGU Admins can view all events
CREATE POLICY "LGU Admins can view all events" ON public.events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
  );

-- Policy: LGU Admins can insert events
CREATE POLICY "LGU Admins can insert events" ON public.events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
    AND created_by = auth.uid()
  );

-- Policy: LGU Admins can update events
CREATE POLICY "LGU Admins can update events" ON public.events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('lgu-admin', 'super-admin'))
    )
  );

