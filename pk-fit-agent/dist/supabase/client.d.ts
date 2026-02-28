import { SupabaseClient } from '@supabase/supabase-js';
import type { AgentConfig } from '../config';
/**
 * Inicializa o Supabase client com a service key
 * (service key para bypass de RLS — o Agent precisa de acesso total)
 */
export declare function initSupabase(config: AgentConfig): SupabaseClient;
/**
 * Retorna o client Supabase (já inicializado)
 */
export declare function getSupabase(): SupabaseClient;
//# sourceMappingURL=client.d.ts.map