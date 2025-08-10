import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db_url = process.env.SUPABASE_URL;
const db_key = process.env.SUPABASE_KEY;

export const supabase = createClient(db_url,db_key)