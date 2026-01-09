-- SCHEMA INTEGRITY CHECK (Run this to ensure all features work)
-- Created: 2026-01-08

-- 1. Ensure Workflow Fields Exist
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS assigned_coordinator_id UUID,
ADD COLUMN IF NOT EXISTS response_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS estimated_resolution_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS task_force_id UUID,
ADD COLUMN IF NOT EXISTS citizen_satisfaction_rating INTEGER;

-- 2. Ensure Evidence Table Exists (For File Uploads)
CREATE TABLE IF NOT EXISTS public.complaint_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    mime_type TEXT,
    uploaded_by UUID,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure RLS Policies (Security)
ALTER TABLE public.complaint_evidence ENABLE ROW LEVEL SECURITY;

-- Allow read access to evidence for authenticated users
CREATE POLICY "Allow read access for authenticated users" 
ON public.complaint_evidence FOR SELECT 
TO authenticated 
USING (true);

-- Allow upload for authenticated users
CREATE POLICY "Allow insert for authenticated users" 
ON public.complaint_evidence FOR INSERT 
TO authenticated 
WITH CHECK (true);
