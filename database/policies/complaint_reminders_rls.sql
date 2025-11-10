-- RLS Policies for complaint_reminders table
-- This allows service role and authenticated users to insert reminder records

-- Enable RLS on complaint_reminders table
ALTER TABLE public.complaint_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to do everything (bypasses RLS)
-- Note: Service role key automatically bypasses RLS, but this policy ensures compatibility
CREATE POLICY IF NOT EXISTS "Service role can manage reminders"
ON public.complaint_reminders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to insert reminders for complaints they submitted
CREATE POLICY IF NOT EXISTS "Users can insert reminders for their complaints"
ON public.complaint_reminders
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.complaints
    WHERE complaints.id = complaint_reminders.complaint_id
    AND complaints.submitted_by = auth.uid()
  )
);

-- Policy: Allow authenticated users to view reminders for their complaints
CREATE POLICY IF NOT EXISTS "Users can view reminders for their complaints"
ON public.complaint_reminders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.complaints
    WHERE complaints.id = complaint_reminders.complaint_id
    AND complaints.submitted_by = auth.uid()
  )
);

-- Policy: Allow LGU admins and officers to view reminders for complaints in their departments
CREATE POLICY IF NOT EXISTS "LGU staff can view reminders for their department complaints"
ON public.complaint_reminders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_reminders.complaint_id
    AND (
      -- Check if user is assigned to this complaint
      EXISTS (
        SELECT 1 FROM public.complaint_assignments ca
        WHERE ca.complaint_id = c.id
        AND ca.assigned_to = auth.uid()
      )
      OR
      -- Check if user's department is assigned to this complaint
      EXISTS (
        SELECT 1 FROM public.complaint_assignments ca
        JOIN public.departments d ON d.id = ca.department_id
        WHERE ca.complaint_id = c.id
        AND d.code = (
          SELECT user_metadata->>'department' FROM auth.users WHERE id = auth.uid()
        )
      )
    )
  )
);

