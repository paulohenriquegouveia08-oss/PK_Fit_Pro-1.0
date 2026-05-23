import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../../config/env.js';

export function getSupabaseAdmin(): SupabaseClient {
  const env = getEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
