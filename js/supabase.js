
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Your Supabase project URL
const SUPABASE_URL = 'https://hptluyjxjbjeplzngpyv.supabase.co';

// Your Supabase Publishable Key
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zDN6wqCKR3pCs7x7gAZ0vQ_A0wOw2o3';

// Create Supabase connection
export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
