-- Create nlp_candidates table for AI Learning Mode
CREATE TABLE IF NOT EXISTS nlp_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term TEXT NOT NULL,
    suggested_category TEXT NOT NULL,
    suggested_subcategory TEXT,
    confidence FLOAT NOT NULL,
    source_text TEXT,
    occurrence_count INT DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookup by term (to increment occurrence_count)
CREATE INDEX IF NOT EXISTS idx_nlp_candidates_term ON nlp_candidates(term);
CREATE INDEX IF NOT EXISTS idx_nlp_candidates_status ON nlp_candidates(status);

-- Comments
COMMENT ON TABLE nlp_candidates IS 'Stores potential new keywords detected by AI for admin review (Auto-Learning Queue)';
COMMENT ON COLUMN nlp_candidates.term IS 'The detected word or phrase';
COMMENT ON COLUMN nlp_candidates.occurrence_count IS 'How many times this term has been seen while pending';
