import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AgentConfig } from '../config';
import { logger } from '../core/logger';

let supabase: SupabaseClient | null = null;

/**
 * Inicializa o Supabase client com a service key
 * (service key para bypass de RLS — o Agent precisa de acesso total)
 */
export function initSupabase(config: AgentConfig): SupabaseClient {
    supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });

    logger.info('Supabase client inicializado');
    return supabase;
}

/**
 * Retorna o client Supabase (já inicializado)
 */
export function getSupabase(): SupabaseClient {
    if (!supabase) {
        throw new Error('Supabase client não inicializado. Chame initSupabase() primeiro.');
    }
    return supabase;
}
