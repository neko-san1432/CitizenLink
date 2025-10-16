-- Quick check: How many complaints exist?
SELECT COUNT(*) as total_complaints FROM public.complaints;

-- Check complaint statuses
SELECT status, COUNT(*) as count 
FROM public.complaints 
GROUP BY status;

-- Check if any complaints are "pending review" (for coordinator)
SELECT COUNT(*) as pending_review_count 
FROM public.complaints 
WHERE status = 'pending review';

-- Sample of complaints
SELECT id, title, status, submitted_at, submitted_by
FROM public.complaints
ORDER BY submitted_at DESC
LIMIT 5;

-- Check users that have submitted complaints
SELECT DISTINCT submitted_by 
FROM public.complaints;


