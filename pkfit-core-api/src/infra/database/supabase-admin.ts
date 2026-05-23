import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from '../../config/env.js';

let _client: SupabaseClient | null = null;

/**
 * Returns a Supabase client authenticated with the SERVICE_ROLE key.
 * This client bypasses all RLS policies and should ONLY be used
 * by the Core API backend — never exposed to the frontend.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const env = getEnv();

  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}
