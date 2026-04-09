import type { AgentConfig } from '../config';
import { getSupabase } from '../supabase/client';
import { logger } from './logger';

// ==========================================
// HEARTBEAT — Pinga o Supabase a cada N ms
// Mantém o status CONNECTED no painel web
// ==========================================

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Inicia o heartbeat — atualiza turnstile_configs a cada intervalo
 */
export function startHeartbeat(config: AgentConfig): void {
    const interval = config.heartbeatInterval;

    logger.info(`Heartbeat iniciado (intervalo: ${interval / 1000}s)`);

    // Primeiro heartbeat imediato
    sendHeartbeat(config).catch(err =>
        logger.warn(`Erro no heartbeat inicial: ${err}`)
    );

    // Timer periódico
    heartbeatTimer = setInterval(async () => {
        await sendHeartbeat(config);
    }, interval);
}

/**
 * Para o heartbeat
 */
export function stopHeartbeat(): void {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        logger.info('Heartbeat parado');
    }
}

/**
 * Envia um heartbeat — atualiza connection_status e last_heartbeat
 */
async function sendHeartbeat(config: AgentConfig): Promise<void> {
    try {
        const supabase = getSupabase();

        const { error } = await supabase
            .from('turnstile_configs')
            .update({
                connection_status: 'CONNECTED',
                last_heartbeat: new Date().toISOString(),
            })
            .eq('id', config.turnstileConfigId);

        if (error) {
            logger.warn(`Heartbeat falhou: ${error.message}`);
        } else {
            logger.debug('💓 Heartbeat enviado');
        }
    } catch (error) {
        logger.warn(`Erro ao enviar heartbeat: ${error}`);
    }
}

/**
 * Marca a catraca como desconectada no banco
 * Chamado ao parar o Agent (graceful shutdown)
 */
export async function markDisconnected(config: AgentConfig): Promise<void> {
    try {
        const supabase = getSupabase();

        await supabase
            .from('turnstile_configs')
            .update({ connection_status: 'DISCONNECTED' })
            .eq('id', config.turnstileConfigId);

        logger.info('Status atualizado para DISCONNECTED');
    } catch (error) {
        logger.warn(`Erro ao marcar desconexão: ${error}`);
    }
}
