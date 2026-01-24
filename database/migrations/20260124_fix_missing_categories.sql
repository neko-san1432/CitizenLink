5-- Fix for Missing Generic Categories in nlp_category_config
-- These are required because nlp_keywords uses them as primary categories for generic terms.

INSERT INTO public.nlp_category_config (category, parent_category, urgency_rating) VALUES
('Infrastructure', 'Infrastructure', 50),
('Public Safety', 'Public Safety', 90),
('Utilities', 'Utilities', 60),
('Sanitation', 'Sanitation', 40),
('Traffic Congestion', 'Traffic Congestion', 45),
('Environment', 'Environment', 85),
('Stray Animals', 'Stray Animals', 40),
('Pest Infestation', 'Pest Infestation', 40),
('Noise Complaint', 'Noise Complaint', 30)
ON CONFLICT (category) DO NOTHING;
