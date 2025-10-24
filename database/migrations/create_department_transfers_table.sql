-- Create department_transfers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.department_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_department text NOT NULL,
  to_department text NOT NULL,
  performed_by uuid NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT department_transfers_pkey PRIMARY KEY (id),
  CONSTRAINT department_transfers_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id),
  CONSTRAINT department_transfers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_department_transfers_user_id ON public.department_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_department_transfers_performed_by ON public.department_transfers(performed_by);
CREATE INDEX IF NOT EXISTS idx_department_transfers_created_at ON public.department_transfers(created_at);

-- Add RLS policies
ALTER TABLE public.department_transfers ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own department transfers
CREATE POLICY IF NOT EXISTS "Users can view their own department transfers" ON public.department_transfers
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for super admins to see all department transfers
CREATE POLICY IF NOT EXISTS "Super admins can view all department transfers" ON public.department_transfers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'super-admin'
    )
  );

-- Policy for inserting department transfers (only super admins and system)
CREATE POLICY IF NOT EXISTS "Super admins can insert department transfers" ON public.department_transfers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'super-admin'
    )
  );

