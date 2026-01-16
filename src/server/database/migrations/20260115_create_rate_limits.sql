-- Create rate_limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    requests JSONB DEFAULT '[]'::jsonb,
    reset_time TIMESTAMPTZ,
    window_ms BIGINT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access
-- Note: Rate limiting is a system function, so typically handled by service role
create policy "Allow full access to service role"
  on public.rate_limits
  for all
  to service_role
  using (true)
  with check (true);

-- Optional: Create index for cleanup optimization if needed
-- CREATE INDEX idx_rate_limits_reset_time ON public.rate_limits(reset_time);
