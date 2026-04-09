import type { AgentConfig } from '../config';
import { getSupabase } from './client';
import { logger } from '../core/logger';

// ==========================================
// SYNC — Sincroniza dados com Supabase
// Busca config atualizada, verifica
// pendências, etc.
// ==========================================

/**
 * Verifica se há comandos pendentes que não foram processados
 * (ex: se o Agent estava offline quando o comando foi enviado)
 */
export async function processPendingCommands(config: AgentConfig): Promise<number> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('access_commands')
        .select('id')
        .eq('academy_id', config.academyId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });

    if (error) {
        logger.warn(`Erro ao buscar comandos pendentes: ${error.message}`);
        return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
        logger.info(`📋 ${count} comando(s) pendente(s) encontrado(s)`);
    }

    return count;
}

/**
 * Busca a configuração mais recente da catraca no banco
 * Útil para detectar mudanças feitas via painel web
 */
export async function fetchLatestConfig(config: AgentConfig): Promise<{
    is_active: boolean;
    brand: string;
    ip_address: string;
    port: number;
} | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('turnstile_configs')
        .select('is_active, brand, ip_address, port')
        .eq('id', config.turnstileConfigId)
        .single();

    if (error) {
        logger.warn(`Erro ao buscar config atualizada: ${error.message}`);
        return null;
    }

    return data;
}

/**
 * Verifica se a catraca foi desativada no painel web
 * Se sim, o Agent deve parar de processar
 */
export async function isTurnstileActive(config: AgentConfig): Promise<boolean> {
    const latestConfig = await fetchLatestConfig(config);
    return latestConfig?.is_active ?? true;
}
