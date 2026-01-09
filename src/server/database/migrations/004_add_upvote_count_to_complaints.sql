-- Up Migration
ALTER TABLE complaints
ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0;

COMMENT ON COLUMN complaints.upvote_count IS 'Number of citizens who have upvoted this complaint or reported it as a duplicate';

-- Down Migration
-- ALTER TABLE complaints DROP COLUMN upvote_count;
