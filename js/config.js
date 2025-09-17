import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const env = window.__ENV__ || { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' }
const supabaseUrl = env.SUPABASE_URL
const supabaseKey = env.SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)