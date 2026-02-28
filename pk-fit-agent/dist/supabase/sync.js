"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPendingCommands = processPendingCommands;
exports.fetchLatestConfig = fetchLatestConfig;
exports.isTurnstileActive = isTurnstileActive;
const client_1 = require("./client");
const logger_1 = require("../core/logger");
// ==========================================
// SYNC — Sincroniza dados com Supabase
// Busca config atualizada, verifica
// pendências, etc.
// ==========================================
/**
 * Verifica se há comandos pendentes que não foram processados
 * (ex: se o Agent estava offline quando o comando foi enviado)
 */
async function processPendingCommands(config) {
    const supabase = (0, client_1.getSupabase)();
    const { data, error } = await supabase
        .from('access_commands')
        .select('id')
        .eq('academy_id', config.academyId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: true });
    if (error) {
        logger_1.logger.warn(`Erro ao buscar comandos pendentes: ${error.message}`);
        return 0;
    }
    const count = data?.length || 0;
    if (count > 0) {
        logger_1.logger.info(`📋 ${count} comando(s) pendente(s) encontrado(s)`);
    }
    return count;
}
/**
 * Busca a configuração mais recente da catraca no banco
 * Útil para detectar mudanças feitas via painel web
 */
async function fetchLatestConfig(config) {
    const supabase = (0, client_1.getSupabase)();
    const { data, error } = await supabase
        .from('turnstile_configs')
        .select('is_active, brand, ip_address, port')
        .eq('id', config.turnstileConfigId)
        .single();
    if (error) {
        logger_1.logger.warn(`Erro ao buscar config atualizada: ${error.message}`);
        return null;
    }
    return data;
}
/**
 * Verifica se a catraca foi desativada no painel web
 * Se sim, o Agent deve parar de processar
 */
async function isTurnstileActive(config) {
    const latestConfig = await fetchLatestConfig(config);
    return latestConfig?.is_active ?? true;
}
//# sourceMappingURL=sync.js.map