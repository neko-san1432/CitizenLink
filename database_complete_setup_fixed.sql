-- CitizenLink Complete Database Setup
-- This is a comprehensive setup script that includes all necessary tables and configurations

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.complaint_updates CASCADE;
DROP TABLE IF EXISTS public.complaints CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    mobile_number TEXT,
    role TEXT DEFAULT 'citizen' CHECK (role IN ('citizen', 'lgu', 'lgu-admin', 'super-admin')),
    department TEXT,
    employee_id TEXT,
    address JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table for tracking login sessions
CREATE TABLE public.user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments table for LGU organization
CREATE TABLE public.departments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Complaints table
CREATE TABLE public.complaints (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed', 'cancelled')),
    location JSONB, -- Store coordinates and address info
    attachments JSONB DEFAULT '[]', -- Array of file URLs
    reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE
);

-- Complaint updates/activities table
CREATE TABLE public.complaint_updates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    update_type TEXT NOT NULL CHECK (update_type IN ('status_change', 'assignment', 'comment', 'attachment', 'resolution')),
    old_value TEXT,
    new_value TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System settings table
CREATE TABLE public.settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value JSONB,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(is_active);
CREATE INDEX idx_complaints_status ON public.complaints(status);
CREATE INDEX idx_complaints_priority ON public.complaints(priority);
CREATE INDEX idx_complaints_reporter ON public.complaints(reporter_id);
CREATE INDEX idx_complaints_assigned_to ON public.complaints(assigned_to);
CREATE INDEX idx_complaints_department ON public.complaints(assigned_department_id);
CREATE INDEX idx_complaint_updates_complaint ON public.complaint_updates(complaint_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Users table policies
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Super admins can view all users" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'super-admin'
        )
    );

CREATE POLICY "LGU admins can view users in their department" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('lgu-admin', 'super-admin')
            AND (users.department = u.department OR u.role = 'super-admin')
        )
    );

-- User sessions policies
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON public.user_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON public.user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Departments policies
CREATE POLICY "Everyone can view active departments" ON public.departments
    FOR SELECT USING (is_active = true);

CREATE POLICY "LGU admins can manage departments" ON public.departments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('lgu-admin', 'super-admin')
        )
    );

-- Complaints policies
CREATE POLICY "Users can view their own complaints" ON public.complaints
    FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Users can create complaints" ON public.complaints
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can update their own complaints" ON public.complaints
    FOR UPDATE USING (auth.uid() = reporter_id);

CREATE POLICY "Assigned users can view complaints" ON public.complaints
    FOR SELECT USING (auth.uid() = assigned_to);

CREATE POLICY "Assigned users can update complaints" ON public.complaints
    FOR UPDATE USING (auth.uid() = assigned_to);

CREATE POLICY "Department members can view department complaints" ON public.complaints
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role IN ('lgu', 'lgu-admin', 'super-admin')
            AND (users.department = complaints.assigned_department_id OR users.role IN ('lgu-admin', 'super-admin'))
        )
    );

-- Complaint updates policies
CREATE POLICY "Users can view updates for their complaints" ON public.complaint_updates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.complaints
            WHERE id = complaint_id
            AND (reporter_id = auth.uid() OR assigned_to = auth.uid())
        )
    );

CREATE POLICY "Users can create updates for their complaints" ON public.complaint_updates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.complaints
            WHERE id = complaint_id
            AND (reporter_id = auth.uid() OR assigned_to = auth.uid())
        )
    );

-- Settings policies
CREATE POLICY "Everyone can view settings" ON public.settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage settings" ON public.settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('lgu-admin', 'super-admin')
        )
    );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_complaints_updated_at BEFORE UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO public.settings (setting_key, setting_value, description, is_system) VALUES
    ('system_name', '"CitizenLink"', 'System name displayed in UI', true),
    ('system_version', '"2.0.0"', 'Current system version', true),
    ('contact_email', '"admin@citizenlink.local"', 'System contact email', true),
    ('max_file_size', '10485760', 'Maximum file size in bytes (10MB)', false),
    ('allowed_file_types', '["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"]', 'Allowed file types for uploads', false),
    ('pagination_limit', '20', 'Default pagination limit', false),
    ('complaint_categories', '["Road Issues", "Waste Management", "Water Supply", "Electricity", "Health Services", "Public Safety", "Environment", "Transportation", "Housing", "Other"]', 'Available complaint categories', false),
    ('complaint_priorities', '["low", "medium", "high", "urgent"]', 'Available complaint priorities', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default departments (example)
INSERT INTO public.departments (name, description, contact_email, contact_phone) VALUES
    ('General Services', 'General municipal services and maintenance', 'services@city.gov', '+63-2-123-4567'),
    ('Health Department', 'Public health and sanitation services', 'health@city.gov', '+63-2-123-4568'),
    ('Engineering', 'Infrastructure and public works', 'engineering@city.gov', '+63-2-123-4569'),
    ('Social Services', 'Community and social welfare programs', 'social@city.gov', '+63-2-123-4570'),
    ('Public Safety', 'Law enforcement and emergency services', 'safety@city.gov', '+63-2-123-4571'),
    ('Environment', 'Environmental protection and sustainability', 'environment@city.gov', '+63-2-123-4572')
ON CONFLICT (name) DO NOTHING;

-- Create a function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, first_name, last_name, mobile_number, role, status, email_verified)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'mobile',
        COALESCE(NEW.raw_user_meta_data->>'role', 'citizen'),
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN 'active' ELSE 'pending' END,
        NEW.email_confirmed_at IS NOT NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to track user login sessions
CREATE OR REPLACE FUNCTION public.track_user_login()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert new session record
    INSERT INTO public.user_sessions (user_id, ip_address, user_agent)
    VALUES (NEW.id, inet_client_addr(), current_setting('request.headers', true)::json->>'user-agent');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for session tracking (optional - can be called manually)
-- This would require additional setup in the application

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Set up realtime subscriptions (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_updates;

COMMENT ON TABLE public.users IS 'Extended user profiles for CitizenLink system';
COMMENT ON TABLE public.complaints IS 'Citizen complaints and reports';
COMMENT ON TABLE public.departments IS 'LGU departments and offices';
COMMENT ON TABLE public.settings IS 'System configuration settings';
COMMENT ON TABLE public.user_sessions IS 'User login session tracking';
COMMENT ON TABLE public.complaint_updates IS 'Complaint status updates and activities';
