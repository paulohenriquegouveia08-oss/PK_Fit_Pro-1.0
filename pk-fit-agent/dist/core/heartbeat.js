"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHeartbeat = startHeartbeat;
exports.stopHeartbeat = stopHeartbeat;
exports.markDisconnected = markDisconnected;
const client_1 = require("../supabase/client");
const logger_1 = require("./logger");
// ==========================================
// HEARTBEAT — Pinga o Supabase a cada N ms
// Mantém o status CONNECTED no painel web
// ==========================================
let heartbeatTimer = null;
/**
 * Inicia o heartbeat — atualiza turnstile_configs a cada intervalo
 */
function startHeartbeat(config) {
    const interval = config.heartbeatInterval;
    logger_1.logger.info(`Heartbeat iniciado (intervalo: ${interval / 1000}s)`);
    // Primeiro heartbeat imediato
    sendHeartbeat(config).catch(err => logger_1.logger.warn(`Erro no heartbeat inicial: ${err}`));
    // Timer periódico
    heartbeatTimer = setInterval(async () => {
        await sendHeartbeat(config);
    }, interval);
}
/**
 * Para o heartbeat
 */
function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        logger_1.logger.info('Heartbeat parado');
    }
}
/**
 * Envia um heartbeat — atualiza connection_status e last_heartbeat
 */
async function sendHeartbeat(config) {
    try {
        const supabase = (0, client_1.getSupabase)();
        const { error } = await supabase
            .from('turnstile_configs')
            .update({
            connection_status: 'CONNECTED',
            last_heartbeat: new Date().toISOString(),
        })
            .eq('id', config.turnstileConfigId);
        if (error) {
            logger_1.logger.warn(`Heartbeat falhou: ${error.message}`);
        }
        else {
            logger_1.logger.debug('💓 Heartbeat enviado');
        }
    }
    catch (error) {
        logger_1.logger.warn(`Erro ao enviar heartbeat: ${error}`);
    }
}
/**
 * Marca a catraca como desconectada no banco
 * Chamado ao parar o Agent (graceful shutdown)
 */
async function markDisconnected(config) {
    try {
        const supabase = (0, client_1.getSupabase)();
        await supabase
            .from('turnstile_configs')
            .update({ connection_status: 'DISCONNECTED' })
            .eq('id', config.turnstileConfigId);
        logger_1.logger.info('Status atualizado para DISCONNECTED');
    }
    catch (error) {
        logger_1.logger.warn(`Erro ao marcar desconexão: ${error}`);
    }
}
//# sourceMappingURL=heartbeat.js.map