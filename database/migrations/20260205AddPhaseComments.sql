-- Migration: Add phase_comments JSONB column to complaints table
-- Purpose: Store phase-specific comments for tracking progress
-- Phases: submitted, verified, under_review, action_taken, resolved

-- Add the phase_comments column (JSONB for structured data)
ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS phase_comments JSONB DEFAULT '{
  "submitted": [],
  "verified": [],
  "under_review": [],
  "action_taken": [],
  "resolved": []
}'::jsonb;

-- Add index for faster querying
CREATE INDEX IF NOT EXISTS idx_complaints_phase_comments 
ON complaints USING GIN (phase_comments);

-- Documentation
COMMENT ON COLUMN complaints.phase_comments IS 'Phase-specific comments: {submitted, verified, under_review, action_taken, resolved}. Each entry: {timestamp, user_id, user_name, comment}';

/*
Phases:
1. submitted     - Citizen filed the complaint
2. verified      - Coordinator verified/categorized
3. under_review  - Being reviewed/assigned to department
4. action_taken  - Officer took action on the issue
5. resolved      - Issue fully resolved

Example structure:
{
  "submitted": [
    {"timestamp": "2026-02-05T10:00:00Z", "user_id": "citizen-123", "user_name": "Maria Garcia", "comment": "Pothole causing accidents on Main St"}
  ],
  "verified": [
    {"timestamp": "2026-02-05T10:30:00Z", "user_id": "coord-456", "user_name": "Ana Santos", "comment": "Verified. Categorized as Road Maintenance, Priority: High"}
  ],
  "under_review": [
    {"timestamp": "2026-02-05T11:00:00Z", "user_id": "coord-456", "user_name": "Ana Santos", "comment": "Assigned to Engineering department"}
  ],
  "action_taken": [
    {"timestamp": "2026-02-05T14:00:00Z", "user_id": "officer-789", "user_name": "Juan Cruz", "comment": "Crew dispatched. Pothole filled."}
  ],
  "resolved": [
    {"timestamp": "2026-02-05T16:00:00Z", "user_id": "officer-789", "user_name": "Juan Cruz", "comment": "Work completed and verified on-site"}
  ]
}
*/
