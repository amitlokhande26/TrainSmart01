-- Add General category to General Training line
-- This migration adds a "General" category under the existing "General Training" line

INSERT INTO public.categories (line_id, name, is_active) 
SELECT id, 'General', true 
FROM public.lines 
WHERE name = 'General Training'
ON CONFLICT (line_id, name) DO NOTHING;
