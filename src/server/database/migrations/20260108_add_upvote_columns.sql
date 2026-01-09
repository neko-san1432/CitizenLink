-- Migration: Add upvote_count and is_duplicate fields
-- Created: 2026-01-08

ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0;

ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;

ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS master_complaint_id UUID REFERENCES public.complaints(id);

ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS coordinator_notes TEXT;

-- Create index for faster duplicate lookup
CREATE INDEX IF NOT EXISTS idx_complaints_location_category 
ON public.complaints(latitude, longitude, category);
