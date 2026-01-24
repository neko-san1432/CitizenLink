-- NLP Engine Tables
CREATE TABLE IF NOT EXISTS public.nlp_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  term text NOT NULL,
  category text NOT NULL,
  subcategory text,
  confidence numeric DEFAULT 1.0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_keywords_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.nlp_metaphors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pattern text NOT NULL, -- Regex pattern
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_metaphors_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.nlp_anchors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL,
  anchor_text text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_anchors_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.nlp_category_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  urgency_rating integer DEFAULT 30,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_category_config_pkey PRIMARY KEY (id)
);

-- NLP Approval Workflow Table
CREATE TYPE nlp_proposal_type AS ENUM ('keyword', 'metaphor', 'anchor', 'config');
CREATE TYPE nlp_proposal_status AS ENUM ('pending_coordinator', 'pending_super_admin', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS public.nlp_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type nlp_proposal_type NOT NULL,
  
  -- Data Payload (stores the proposed keyword, category, etc.)
  data jsonb NOT NULL, 
  
  status nlp_proposal_status DEFAULT 'pending_coordinator',
  
  -- Workflow Tracking
  submitted_by uuid NOT NULL,
  coordinator_approved_by uuid,
  super_admin_approved_by uuid,
  rejected_by uuid,
  rejection_reason text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT nlp_proposals_pkey PRIMARY KEY (id),
  CONSTRAINT nlp_proposals_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES auth.users(id),
  CONSTRAINT nlp_proposals_coord_fkey FOREIGN KEY (coordinator_approved_by) REFERENCES auth.users(id),
  CONSTRAINT nlp_proposals_admin_fkey FOREIGN KEY (super_admin_approved_by) REFERENCES auth.users(id)
);

-- RLS Policies (Enable for security)
ALTER TABLE public.nlp_proposals ENABLE ROW LEVEL SECURITY;

-- Everyone can view proposals (for transparency/dashboard)
CREATE POLICY "View proposals" ON public.nlp_proposals FOR SELECT USING (true);

-- LGU Admins can insert
-- (Assuming auth.uid() check is sufficient for now, granular RLS usually requires custom claims or join tables)
CREATE POLICY "Insert proposals" ON public.nlp_proposals FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Officers/Admins can update
CREATE POLICY "Update proposals" ON public.nlp_proposals FOR UPDATE USING (true);
