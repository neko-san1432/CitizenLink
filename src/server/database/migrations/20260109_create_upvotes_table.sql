-- Create table to track individual upvotes to prevent duplicates/spam
CREATE TABLE IF NOT EXISTS public.complaint_upvotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- References auth.users implicitly
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(complaint_id, user_id)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_complaint_upvotes_user ON public.complaint_upvotes(user_id);
CREATE INDEX IF NOT EXISTS idx_complaint_upvotes_complaint ON public.complaint_upvotes(complaint_id);
