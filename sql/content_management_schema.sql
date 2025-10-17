-- Content Management Schema for News, Events, and Notices
-- Date: 2025-10-17

-- 1) News Table
CREATE TABLE IF NOT EXISTS public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  content text NOT NULL,
  excerpt text,
  image_url text,
  author_id uuid,
  category varchar(100),
  tags text[] DEFAULT '{}',
  status varchar(50) DEFAULT 'draft', -- draft, published, archived
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_status ON public.news (status);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON public.news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON public.news (category);

-- 2) Events Table
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  description text NOT NULL,
  location varchar(255),
  event_date timestamptz NOT NULL,
  end_date timestamptz,
  image_url text,
  organizer varchar(255),
  category varchar(100),
  tags text[] DEFAULT '{}',
  status varchar(50) DEFAULT 'upcoming', -- upcoming, ongoing, completed, cancelled
  max_participants integer,
  registration_required boolean DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON public.events (status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date ASC);
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events (category);

-- 3) Notices Table
CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  content text NOT NULL,
  priority varchar(50) DEFAULT 'normal', -- low, normal, high, urgent
  type varchar(100), -- announcement, alert, reminder, advisory
  target_audience text[] DEFAULT '{}', -- all, citizens, lgu_admin, lgu_officer
  image_url text,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  status varchar(50) DEFAULT 'active', -- active, expired, archived
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notices_status ON public.notices (status);
CREATE INDEX IF NOT EXISTS idx_notices_priority ON public.notices (priority);
CREATE INDEX IF NOT EXISTS idx_notices_valid_from ON public.notices (valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_notices_valid_until ON public.notices (valid_until);

-- 4) Enable Row Level Security (RLS)
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 5) RLS Policies - Allow public read access for published content
CREATE POLICY "Public can view published news"
  ON public.news FOR SELECT
  USING (status = 'published');

CREATE POLICY "Public can view upcoming and ongoing events"
  ON public.events FOR SELECT
  USING (status IN ('upcoming', 'ongoing'));

CREATE POLICY "Public can view active notices"
  ON public.notices FOR SELECT
  USING (status = 'active' AND (valid_until IS NULL OR valid_until > now()));

-- 6) Admin policies (authenticated users with admin role can manage)
-- Note: Adjust these based on your auth setup
CREATE POLICY "Admins can manage news"
  ON public.news FOR ALL
  USING (auth.jwt() ->> 'role' IN ('lgu_admin', 'super_admin'));

CREATE POLICY "Admins can manage events"
  ON public.events FOR ALL
  USING (auth.jwt() ->> 'role' IN ('lgu_admin', 'super_admin'));

CREATE POLICY "Admins can manage notices"
  ON public.notices FOR ALL
  USING (auth.jwt() ->> 'role' IN ('lgu_admin', 'super_admin'));
