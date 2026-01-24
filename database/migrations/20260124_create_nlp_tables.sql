-- Migration: Create NLP Tables
-- Description: Stores dynamic keywords, metaphors, and category configs for the Advanced Decision Engine
-- Author: CitizenLink AI
-- Date: 2026-01-24

-- 1. NLP Category Configuration (Urgency & Hierarchy)
CREATE TABLE public.nlp_category_config (
    category text PRIMARY KEY,
    parent_category text, -- Maps distinct subcategories (e.g. 'Pothole') to system parents (e.g. 'Infrastructure')
    urgency_rating integer DEFAULT 30 CHECK (urgency_rating BETWEEN 0 AND 100),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. NLP Keywords Dictionary
CREATE TABLE public.nlp_keywords (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    term text NOT NULL, -- The keyword or phrase (lowercase)
    category text NOT NULL, -- Main category (e.g. 'Infrastructure')
    subcategory text, -- Specific subcategory (e.g. 'Pothole')
    language text DEFAULT 'all', -- 'en', 'tl', 'ceb', 'all'
    confidence numeric DEFAULT 0.8 CHECK (confidence BETWEEN 0 AND 1.0),
    translation text, -- English translation for local dialects
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT nlp_keywords_pkey PRIMARY KEY (id),
    CONSTRAINT nlp_keywords_term_unique UNIQUE (term)
);

-- 3. NLP Metaphor Filters (False Positive Prevention)
CREATE TABLE public.nlp_metaphors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    pattern text NOT NULL, -- Regex pattern
    literal_meaning text,
    actual_meaning text,
    filter_type text, -- 'METAPHOR', 'GAMING', 'HYPERBOLE'
    is_emergency boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT nlp_metaphors_pkey PRIMARY KEY (id)
);

-- 4. NLP Category Anchors (For TensorFlow/USE Fallback)
CREATE TABLE public.nlp_anchors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    category text REFERENCES public.nlp_category_config(category),
    anchor_text text NOT NULL, -- The phrase to compare against (e.g. "broken road with potholes")
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT nlp_anchors_pkey PRIMARY KEY (id)
);

-- 5. NLP Logs (For tracking performance and auto-categorization success)
CREATE TABLE public.nlp_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    complaint_id uuid REFERENCES public.complaints(id),
    input_text text,
    detected_category text,
    detected_urgency integer,
    method_used text, -- 'KEYWORD', 'TENSORFLOW', 'FALLBACK'
    confidence_score numeric,
    processing_time_ms numeric,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT nlp_logs_pkey PRIMARY KEY (id)
);

-- Indexes for performance
CREATE INDEX idx_nlp_keywords_term ON public.nlp_keywords(term);
CREATE INDEX idx_nlp_keywords_category ON public.nlp_keywords(category);
CREATE INDEX idx_nlp_anchors_category ON public.nlp_anchors(category);
