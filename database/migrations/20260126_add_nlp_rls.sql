-- Migration: Add RLS Policies to NLP Tables
-- Description: Secures the NLP tables by enabling Row Level Security and defining access policies.
-- Date: 2026-01-26

-- =================================================================
-- 1. Enable RLS on all tables
-- =================================================================

ALTER TABLE public.nlp_category_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nlp_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nlp_metaphors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nlp_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nlp_dictionary_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nlp_logs ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- 2. Define READ Policies (SELECT)
-- =================================================================

-- Allow all authenticated users to read configuration tables
-- (Needed for dashboard, heatmap, and complaint submission AI feedback)

CREATE POLICY "Enable read access for authenticated users" ON public.nlp_category_config
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.nlp_keywords
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.nlp_metaphors
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.nlp_anchors
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON public.nlp_dictionary_rules
    FOR SELECT USING (auth.role() = 'authenticated');

-- Logs should only be visible to Admins
CREATE POLICY "Enable read access for admins only" ON public.nlp_logs
    FOR SELECT USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'super-admin' OR 
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'lgu-admin'
    );

-- =================================================================
-- 3. Define WRITE Policies (INSERT, UPDATE, DELETE)
-- =================================================================

-- Only Admins (Super Admin or LGU Admin) can modify the NLP dictionaries

-- nlp_category_config
CREATE POLICY "Enable write access for admins" ON public.nlp_category_config
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super-admin', 'lgu-admin')
    );

-- nlp_keywords
CREATE POLICY "Enable write access for admins" ON public.nlp_keywords
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super-admin', 'lgu-admin')
    );

-- nlp_metaphors
CREATE POLICY "Enable write access for admins" ON public.nlp_metaphors
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super-admin', 'lgu-admin')
    );

-- nlp_anchors
CREATE POLICY "Enable write access for admins" ON public.nlp_anchors
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super-admin', 'lgu-admin')
    );

-- nlp_dictionary_rules
CREATE POLICY "Enable write access for admins" ON public.nlp_dictionary_rules
    FOR ALL USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super-admin', 'lgu-admin')
    );

-- nlp_logs 
-- (Assuming logs are inserted by the server using Service Role, which bypasses RLS.
-- If frontend inserts logs directly, uncomment the policy below)
/*
CREATE POLICY "Enable insert access for authenticated users" ON public.nlp_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
*/
