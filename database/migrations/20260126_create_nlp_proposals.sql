-- ============================================================================
-- Migration: Create NLP Proposals Table (HITL Training Workflow)
-- Run this if nlp_proposals table does not exist
-- ============================================================================

-- 1. Create enum types if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nlp_proposal_type') THEN
        CREATE TYPE nlp_proposal_type AS ENUM ('keyword', 'metaphor', 'anchor', 'config');
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nlp_proposal_status') THEN
        CREATE TYPE nlp_proposal_status AS ENUM ('pending_coordinator', 'pending_super_admin', 'approved', 'rejected');
    END IF;
END
$$;

-- 2. Create the nlp_proposals table
CREATE TABLE IF NOT EXISTS public.nlp_proposals (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    type text NOT NULL,  -- Using text instead of enum for flexibility
    
    -- Data Payload (stores the proposed keyword, category, etc.)
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    
    status text DEFAULT 'pending_coordinator',
    
    -- Workflow Tracking
    submitted_by uuid,
    coordinator_approved_by uuid,
    super_admin_approved_by uuid,
    rejected_by uuid,
    rejection_reason text,
    
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT nlp_proposals_pkey PRIMARY KEY (id)
);

-- 3. Add foreign keys if they don't exist (won't fail if auth.users not available)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'nlp_proposals_submitted_by_fkey'
    ) THEN
        BEGIN
            ALTER TABLE public.nlp_proposals 
                ADD CONSTRAINT nlp_proposals_submitted_by_fkey 
                FOREIGN KEY (submitted_by) REFERENCES auth.users(id);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add submitted_by FK - this is OK if using service role';
        END;
    END IF;
END
$$;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_nlp_proposals_status ON public.nlp_proposals(status);
CREATE INDEX IF NOT EXISTS idx_nlp_proposals_type ON public.nlp_proposals(type);
CREATE INDEX IF NOT EXISTS idx_nlp_proposals_submitted_by ON public.nlp_proposals(submitted_by);

-- 5. Enable RLS
ALTER TABLE public.nlp_proposals ENABLE ROW LEVEL SECURITY;

-- 6. Create permissive policies for authenticated users
DROP POLICY IF EXISTS "View proposals" ON public.nlp_proposals;
CREATE POLICY "View proposals" ON public.nlp_proposals 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Insert proposals" ON public.nlp_proposals;
CREATE POLICY "Insert proposals" ON public.nlp_proposals 
    FOR INSERT 
    WITH CHECK (true);  -- Allow all inserts (will be filtered by backend auth)

DROP POLICY IF EXISTS "Update proposals" ON public.nlp_proposals;
CREATE POLICY "Update proposals" ON public.nlp_proposals 
    FOR UPDATE 
    USING (true);

-- 7. Grant permissions
GRANT ALL ON public.nlp_proposals TO authenticated;
GRANT ALL ON public.nlp_proposals TO service_role;

-- ============================================================================
-- Verify: Run this to check if table was created successfully
-- SELECT * FROM public.nlp_proposals LIMIT 1;
-- ============================================================================
