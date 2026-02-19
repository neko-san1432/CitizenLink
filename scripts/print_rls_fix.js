require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function fixRLS() {
    console.log('Starting RLS Fix...');

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('Missing Supabase credentials in .env');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false }
    });

    // SQL to execute
    const sql = `
    -- 1. Create Safe Admin Check Function
    CREATE OR REPLACE FUNCTION public.check_is_admin_safe()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin', 'coordinator', 'lgu-admin', 'complaint-coordinator')
      );
    $$;

    -- 2. Drop Potentially Recursive Policies
    DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admin View All" ON public.user_profiles;
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
    DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
    DROP POLICY IF EXISTS "Admins and Coordinators can view all" ON public.user_profiles;

    -- 3. Recreate Policies
    CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = id);

    CREATE POLICY "Admins and Coordinators can view all" ON public.user_profiles
    FOR SELECT
    USING (check_is_admin_safe());

    CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = id);
  `;

    // We cannot execute SQL directly via JS client unless we use a workaround
    // Workaround: Use RPC if available, or just log the SQL for the user?
    // Actually, we can try to use the 'pg' library if we had connection string, but we only have URL/Key.
    // BUT! We can't run raw SQL via supabase-js client.

    // So this script is actually useless for applying the fix unless we have an RPC 
    // function like 'exec_sql' exposed (which is dangerous and likely not there).

    console.log('=====================================================');
    console.log('CANNOT EXECUTE RAW SQL VIA SUPABASE JS CLIENT DIRECTLY');
    console.log('Please execute the following SQL in your Supabase SQL Editor:');
    console.log('=====================================================');
    console.log(sql);
    console.log('=====================================================');

    // Checking if we can invoke a known RPC that might work?
    // No known unrestricted SQL exec RPC.
}

fixRLS();
