-- Migration: Create ID Verifications Table
-- Purpose: Store ID verification data to prevent duplicate accounts and verify user identity
-- Author: CitizenLink Development Team
-- Date: 2025-11-23

-- Create id_verifications table
CREATE TABLE IF NOT EXISTS public.id_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id_number TEXT NOT NULL,
    id_type TEXT NOT NULL,
    extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'flagged')),
    confidence_score NUMERIC(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index on id_number to prevent duplicate IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_id_verifications_id_number ON public.id_verifications(id_number);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_id_verifications_user_id ON public.id_verifications(user_id);

-- Create index on verification_status for admin queries
CREATE INDEX IF NOT EXISTS idx_id_verifications_status ON public.id_verifications(verification_status);

-- Enable Row Level Security
ALTER TABLE public.id_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own verification records
CREATE POLICY "Users can view own verification"
    ON public.id_verifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own verification records
CREATE POLICY "Users can insert own verification"
    ON public.id_verifications
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all verifications
CREATE POLICY "Admins can view all verifications"
    ON public.id_verifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (auth.users.raw_user_meta_data->>'role' IN ('super-admin', 'lgu-admin'))
        )
    );

-- Policy: Admins can update verification status
CREATE POLICY "Admins can update verifications"
    ON public.id_verifications
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (auth.users.raw_user_meta_data->>'role' IN ('super-admin', 'lgu-admin'))
        )
    );

-- Create function to check if ID number exists
CREATE OR REPLACE FUNCTION public.check_id_number_exists(p_id_number TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.id_verifications
        WHERE id_number = p_id_number
    );
END;
$$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_id_verification_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_id_verification_timestamp
    BEFORE UPDATE ON public.id_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_id_verification_timestamp();

-- Grant necessary permissions
GRANT SELECT, INSERT ON public.id_verifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_id_number_exists(TEXT) TO authenticated;

-- Comment on table and columns
COMMENT ON TABLE public.id_verifications IS 'Stores ID verification data for user identity verification';
COMMENT ON COLUMN public.id_verifications.id_number IS 'Unique ID number extracted from the document';
COMMENT ON COLUMN public.id_verifications.id_type IS 'Type of ID (PhilID, Driver License, etc.)';
COMMENT ON COLUMN public.id_verifications.extracted_data IS 'Full OCR extraction results in JSON format';
COMMENT ON COLUMN public.id_verifications.verification_status IS 'Current verification status';
COMMENT ON COLUMN public.id_verifications.confidence_score IS 'OCR confidence score (0-100)';
