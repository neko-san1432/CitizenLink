-- Migration: Secure Unrestricted Tables
-- Description: Enables RLS and adds policies for department_subcategory_mapping and enforces them on NLP tables.
-- Date: 2026-02-12
-- Update: Switched from user_metadata (insecure) to public.user_profiles (secure) for role checks.

-- =================================================================
-- 1. department_subcategory_mapping
-- =================================================================

ALTER TABLE public.department_subcategory_mapping ENABLE ROW LEVEL security;

-- Read: Allow all authenticated users (needed for frontend forms)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.department_subcategory_mapping;
CREATE POLICY "Enable read access for authenticated users" ON public.department_subcategory_mapping
    FOR SELECT USING (auth.role() = 'authenticated');

-- Write: Allow only Admins (Super Admin and LGU Admin)
DROP POLICY IF EXISTS "Enable write access for admins" ON public.department_subcategory_mapping;
CREATE POLICY "Enable write access for admins" ON public.department_subcategory_mapping
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('super-admin', 'lgu-admin')
        )
    );


-- =================================================================
-- 2. NLP Tables (Re-enforcing policies to fix UNRESTRICTED status)
-- =================================================================

-- nlp_anchors
ALTER TABLE public.nlp_anchors ENABLE ROW LEVEL security;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.nlp_anchors;
CREATE POLICY "Enable read access for authenticated users" ON public.nlp_anchors
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable write access for admins" ON public.nlp_anchors;
CREATE POLICY "Enable write access for admins" ON public.nlp_anchors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('super-admin', 'lgu-admin')
        )
    );

-- nlp_category_config
ALTER TABLE public.nlp_category_config ENABLE ROW LEVEL security;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.nlp_category_config;
CREATE POLICY "Enable read access for authenticated users" ON public.nlp_category_config
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable write access for admins" ON public.nlp_category_config;
CREATE POLICY "Enable write access for admins" ON public.nlp_category_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('super-admin', 'lgu-admin')
        )
    );

-- nlp_dictionary_rules
ALTER TABLE public.nlp_dictionary_rules ENABLE ROW LEVEL security;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.nlp_dictionary_rules;
CREATE POLICY "Enable read access for authenticated users" ON public.nlp_dictionary_rules
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable write access for admins" ON public.nlp_dictionary_rules;
CREATE POLICY "Enable write access for admins" ON public.nlp_dictionary_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('super-admin', 'lgu-admin')
        )
    );

-- nlp_keywords
ALTER TABLE public.nlp_keywords ENABLE ROW LEVEL security;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.nlp_keywords;
CREATE POLICY "Enable read access for authenticated users" ON public.nlp_keywords
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable write access for admins" ON public.nlp_keywords;
CREATE POLICY "Enable write access for admins" ON public.nlp_keywords
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('super-admin', 'lgu-admin')
        )
    );

-- nlp_metaphors
ALTER TABLE public.nlp_metaphors ENABLE ROW LEVEL security;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.nlp_metaphors;
CREATE POLICY "Enable read access for authenticated users" ON public.nlp_metaphors
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable write access for admins" ON public.nlp_metaphors;
CREATE POLICY "Enable write access for admins" ON public.nlp_metaphors
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('super-admin', 'lgu-admin')
        )
    );

-- nlp_logs
ALTER TABLE public.nlp_logs ENABLE ROW LEVEL security;

-- Logs: Read only for Admins
DROP POLICY IF EXISTS "Enable read access for admins only" ON public.nlp_logs;
CREATE POLICY "Enable read access for admins only" ON public.nlp_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role IN ('super-admin', 'lgu-admin')
        )
    );
