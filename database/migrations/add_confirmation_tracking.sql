-- Migration: Add Confirmation Tracking Fields
-- This migration adds fields to track confirmation states between citizens and responders

-- Add fields to track confirmation states (only missing ones)
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS all_responders_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS responders_confirmation_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'waiting_for_responders', 'waiting_for_complainant', 'confirmed', 'disputed'));

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_complaints_confirmation_status ON public.complaints(confirmation_status);
CREATE INDEX IF NOT EXISTS idx_complaints_citizen_confirmed ON public.complaints(confirmed_by_citizen);
CREATE INDEX IF NOT EXISTS idx_complaints_responders_confirmed ON public.complaints(all_responders_confirmed);

-- Add comments for documentation
COMMENT ON COLUMN public.complaints.citizen_confirmed_resolution IS 'Whether the citizen has confirmed the resolution';
COMMENT ON COLUMN public.complaints.citizen_confirmation_date IS 'When the citizen confirmed the resolution';
COMMENT ON COLUMN public.complaints.all_responders_confirmed IS 'Whether all assigned responders have marked the complaint as complete';
COMMENT ON COLUMN public.complaints.responders_confirmation_date IS 'When all responders confirmed completion';
COMMENT ON COLUMN public.complaints.confirmation_status IS 'Current confirmation status: pending, waiting_for_responders, waiting_for_complainant, confirmed, disputed';

-- Create a function to update confirmation status based on current state
CREATE OR REPLACE FUNCTION update_complaint_confirmation_status(complaint_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    complaint_record RECORD;
    total_assignments INTEGER;
    completed_assignments INTEGER;
    new_status TEXT;
BEGIN
    -- Get complaint details
    SELECT * INTO complaint_record 
    FROM public.complaints 
    WHERE id = complaint_uuid;
    
    IF NOT FOUND THEN
        RETURN 'complaint_not_found';
    END IF;
    
    -- Count total and completed assignments
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
    INTO total_assignments, completed_assignments
    FROM public.complaint_assignments 
    WHERE complaint_id = complaint_uuid;
    
    -- Determine new confirmation status
    IF complaint_record.confirmed_by_citizen AND (total_assignments = 0 OR completed_assignments = total_assignments) THEN
        new_status := 'confirmed';
    ELSIF complaint_record.confirmed_by_citizen AND completed_assignments < total_assignments THEN
        new_status := 'waiting_for_responders';
    ELSIF NOT complaint_record.confirmed_by_citizen AND (total_assignments = 0 OR completed_assignments = total_assignments) THEN
        new_status := 'waiting_for_complainant';
    ELSE
        new_status := 'pending';
    END IF;
    
    -- Update the complaint
    UPDATE public.complaints 
    SET 
        confirmation_status = new_status,
        all_responders_confirmed = (total_assignments > 0 AND completed_assignments = total_assignments),
        responders_confirmation_date = CASE 
            WHEN total_assignments > 0 AND completed_assignments = total_assignments AND responders_confirmation_date IS NULL 
            THEN NOW() 
            ELSE responders_confirmation_date 
        END,
        updated_at = NOW()
    WHERE id = complaint_uuid;
    
    RETURN new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get confirmation status for display
CREATE OR REPLACE FUNCTION get_complaint_confirmation_message(complaint_uuid UUID, user_role TEXT)
RETURNS TEXT AS $$
DECLARE
    complaint_record RECORD;
    total_assignments INTEGER;
    completed_assignments INTEGER;
    message TEXT;
BEGIN
    -- Get complaint details
    SELECT * INTO complaint_record 
    FROM public.complaints 
    WHERE id = complaint_uuid;
    
    IF NOT FOUND THEN
        RETURN 'Complaint not found';
    END IF;
    
    -- Count assignments
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
    INTO total_assignments, completed_assignments
    FROM public.complaint_assignments 
    WHERE complaint_id = complaint_uuid;
    
    -- Determine message based on user role and current state
    IF user_role = 'citizen' THEN
        IF complaint_record.confirmed_by_citizen THEN
            IF total_assignments = 0 OR completed_assignments = total_assignments THEN
                message := 'Resolution confirmed by all parties';
            ELSE
                message := 'Waiting for responders'' confirmation';
            END IF;
        ELSE
            IF total_assignments = 0 OR completed_assignments = total_assignments THEN
                message := 'Please confirm the resolution';
            ELSE
                message := 'Waiting for responders to complete their tasks';
            END IF;
        END IF;
    ELSE
        -- For LGU users (admin/officer)
        IF complaint_record.confirmed_by_citizen THEN
            IF total_assignments = 0 OR completed_assignments = total_assignments THEN
                message := 'Resolution confirmed by all parties';
            ELSE
                message := 'Citizen confirmed, waiting for remaining responders';
            END IF;
        ELSE
            IF total_assignments = 0 OR completed_assignments = total_assignments THEN
                message := 'Waiting for complainant''s confirmation';
            ELSE
                message := 'Some responders still need to complete their tasks';
            END IF;
        END IF;
    END IF;
    
    RETURN message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_complaint_confirmation_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_complaint_confirmation_message(UUID, TEXT) TO authenticated;

-- Add comments
COMMENT ON FUNCTION update_complaint_confirmation_status(UUID) IS 'Updates the confirmation status of a complaint based on current state';
COMMENT ON FUNCTION get_complaint_confirmation_message(UUID, TEXT) IS 'Returns appropriate confirmation message based on user role and complaint state';

-- Create trigger to automatically update confirmation status when assignments change
CREATE OR REPLACE FUNCTION trigger_update_confirmation_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update confirmation status for the affected complaint
    PERFORM update_complaint_confirmation_status(COALESCE(NEW.complaint_id, OLD.complaint_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on complaint_assignments table
CREATE TRIGGER trigger_complaint_assignments_confirmation_update
    AFTER INSERT OR UPDATE OR DELETE ON public.complaint_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_confirmation_status();

-- Update existing complaints to have proper confirmation status
UPDATE public.complaints 
SET confirmation_status = update_complaint_confirmation_status(id)
WHERE confirmation_status IS NULL OR confirmation_status = 'pending';
