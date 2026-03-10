-- Remove subcategory related columns from NLP tables

-- nlp_candidates
ALTER TABLE nlp_candidates DROP COLUMN IF EXISTS suggested_subcategory;

-- nlp_keywords
ALTER TABLE nlp_keywords DROP COLUMN IF EXISTS subcategory;

-- nlp_pending_reviews
ALTER TABLE nlp_pending_reviews DROP COLUMN IF EXISTS detected_subcategory;
ALTER TABLE nlp_pending_reviews DROP COLUMN IF EXISTS trained_subcategory;
