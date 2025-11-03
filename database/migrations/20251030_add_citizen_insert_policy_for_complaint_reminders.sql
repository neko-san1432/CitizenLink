-- Allow citizens to insert reminder records for their own complaints
-- This fixes RLS errors when citizens trigger manual reminders from the UI

ALTER TABLE public.complaint_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Create policy if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'complaint_reminders' 
      AND policyname = 'Citizens can insert reminders for own complaints'
  ) THEN
    EXECUTE 'CREATE POLICY "Citizens can insert reminders for own complaints" '
         || 'ON public.complaint_reminders '
         || 'FOR INSERT '
         || 'WITH CHECK ( '
         || '  complaint_id IN (SELECT id FROM public.complaints WHERE submitted_by = auth.uid()) '
         || '  AND (reminded_by IS NULL OR reminded_by = auth.uid()) '
         || ')';
  END IF;
END$$;

-- Optional: ensure readers can see their own inserted reminders (already covered by existing SELECT policy)

