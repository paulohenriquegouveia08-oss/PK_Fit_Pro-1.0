import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { AgentConfig } from '../config'
import { logger } from '../core/logger'

let _supabase: SupabaseClient | null = null

export function initSupabase(config: AgentConfig): SupabaseClient {
  _supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  })

  logger.info('Supabase client inicializado')
  return _supabase
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error('Supabase client não inicializado. Chame initSupabase() primeiro.')
  }
  return _supabase
}

export const supabase = {
  from(table: string) {
    return getSupabase().from(table)
  },
  rpc(fn: string, args?: Record<string, unknown>) {
    return getSupabase().rpc(fn, args)
  },
  channel(name: string) {
    return getSupabase().channel(name)
  },
  removeChannel(channel: unknown) {
    return getSupabase().removeChannel(channel as any)
  },
  storage(bucket: string) {
    return getSupabase().storage.from(bucket)
  }
}