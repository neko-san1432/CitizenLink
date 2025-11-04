-- Add reminder tracking table
CREATE TABLE IF NOT EXISTS public.complaint_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  reminded_at timestamp with time zone DEFAULT now(),
  reminder_count integer DEFAULT 1,
  reminded_by uuid,
  reminder_type text DEFAULT 'manual',
  CONSTRAINT complaint_reminders_pkey PRIMARY KEY (id),
  CONSTRAINT complaint_reminders_complaint_id_fkey FOREIGN KEY (complaint_id) REFERENCES public.complaints(id),
  CONSTRAINT complaint_reminders_reminded_by_fkey FOREIGN KEY (reminded_by) REFERENCES auth.users(id)
);

-- Add new fields to complaints table
ALTER TABLE public.complaints 
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS preferred_departments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resolution_notes text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid,
  ADD COLUMN IF NOT EXISTS resolved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmed_by_citizen boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS citizen_confirmation_date timestamp with time zone;

-- Add foreign key for cancelled_by
ALTER TABLE public.complaints 
  ADD CONSTRAINT complaints_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES auth.users(id);

-- Add foreign key for resolved_by  
ALTER TABLE public.complaints 
  ADD CONSTRAINT complaints_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_complaints_last_activity ON complaints(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_department ON complaint_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_complaint_assignments_assigned_to ON complaint_assignments(assigned_to);

-- Add RLS policies for new tables
ALTER TABLE public.complaint_reminders ENABLE ROW LEVEL SECURITY;

-- Policy for complaint_reminders - users can see reminders for their complaints
CREATE POLICY "Users can view reminders for their complaints" ON public.complaint_reminders
  FOR SELECT USING (
    complaint_id IN (
      SELECT id FROM public.complaints 
      WHERE submitted_by = auth.uid()
    )
  );

-- Policy for complaint_reminders - coordinators and admins can see all reminders
CREATE POLICY "Coordinators and admins can view all reminders" ON public.complaint_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('complaint-coordinator', 'super-admin', 'lgu-admin', 'lgu-officer'))
    )
  );

-- Policy for complaint_reminders - coordinators and admins can insert reminders
CREATE POLICY "Coordinators and admins can insert reminders" ON public.complaint_reminders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (raw_user_meta_data->>'role' IN ('complaint-coordinator', 'super-admin', 'lgu-admin', 'lgu-officer'))
    )
  );
