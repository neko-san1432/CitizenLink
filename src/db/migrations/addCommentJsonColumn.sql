-- Migration: Add 'comment' JSONB column to complaints table
-- This stores timeline comments directly on the complaint record.
-- Structure:
-- {
--   "submitted": { "date": "...", "comment": "..." },
--   "verified": { "date": "...", "comment": "..." },
--   "under_review": { "date": "...", "comment": "..." },
--   "action_taken": { "date": "...", "comment": "..." },
--   "resolved": { "date": "...", "comment": "..." }
-- }

ALTER TABLE public.complaints
ADD COLUMN comment JSONB DEFAULT '{}'::jsonb;
