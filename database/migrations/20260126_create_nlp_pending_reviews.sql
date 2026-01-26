-- ============================================================================
-- Migration: Create NLP Pending Reviews Table (Auto-Queue for Low Confidence)
-- This enables HITL (Human-in-the-Loop) training when NLP confidence is low
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nlp_pending_reviews (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    
    -- Source complaint info
    complaint_id uuid REFERENCES public.complaints(id) ON DELETE CASCADE,
    text text NOT NULL,  -- The text that was classified
    
    -- NLP classification result
    detected_category text,
    detected_subcategory text,
    confidence numeric,
    method text,  -- 'RULE_BASED', 'AI_TENSORFLOW', 'FALLBACK'
    matched_term text,  -- If rule-based, which term matched
    
    -- Review workflow
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    
    -- Training result (if resolved)
    trained_keyword text,
    trained_category text,
    trained_subcategory text,
    
    -- Metadata
    resolved_at timestamp with time zone,
    resolved_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT nlp_pending_reviews_pkey PRIMARY KEY (id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_nlp_pending_reviews_status ON public.nlp_pending_reviews(status);
CREATE INDEX IF NOT EXISTS idx_nlp_pending_reviews_complaint ON public.nlp_pending_reviews(complaint_id);
CREATE INDEX IF NOT EXISTS idx_nlp_pending_reviews_created ON public.nlp_pending_reviews(created_at DESC);

-- Enable RLS
ALTER TABLE public.nlp_pending_reviews ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "View pending reviews" ON public.nlp_pending_reviews;
CREATE POLICY "View pending reviews" ON public.nlp_pending_reviews 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insert pending reviews" ON public.nlp_pending_reviews;
CREATE POLICY "Insert pending reviews" ON public.nlp_pending_reviews 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Update pending reviews" ON public.nlp_pending_reviews;
CREATE POLICY "Update pending reviews" ON public.nlp_pending_reviews 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Delete pending reviews" ON public.nlp_pending_reviews;
CREATE POLICY "Delete pending reviews" ON public.nlp_pending_reviews 
    FOR DELETE USING (true);

-- Permissions
GRANT ALL ON public.nlp_pending_reviews TO authenticated;
GRANT ALL ON public.nlp_pending_reviews TO service_role;

-- ============================================================================
-- Verify: SELECT * FROM public.nlp_pending_reviews LIMIT 1;
-- ============================================================================
