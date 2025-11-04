-- Migration: Add evidence_type tracking to complaint_evidence table
-- This allows distinguishing between initial evidence and completion evidence

-- Add evidence_type column
ALTER TABLE public.complaint_evidence 
ADD COLUMN IF NOT EXISTS evidence_type TEXT DEFAULT 'initial' 
CHECK (evidence_type IN ('initial', 'completion'));

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_complaint_evidence_type 
ON public.complaint_evidence(evidence_type);

-- Add comment for documentation
COMMENT ON COLUMN public.complaint_evidence.evidence_type IS 'Type of evidence: initial (from citizen) or completion (from officer/admin)';

-- Update existing records to be 'initial' type
UPDATE public.complaint_evidence 
SET evidence_type = 'initial' 
WHERE evidence_type IS NULL;

