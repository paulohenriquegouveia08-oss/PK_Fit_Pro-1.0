"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startListener = startListener;
exports.stopListener = stopListener;
const client_1 = require("./client");
const logger_1 = require("../core/logger");
let channel = null;
/**
 * Inicia o listener que escuta novos comandos via Supabase Realtime
 */
function startListener(config, adapter) {
    const supabase = (0, client_1.getSupabase)();
    logger_1.logger.info('Realtime listener iniciado — escutando comandos do painel web...');
    channel = supabase
        .channel('agent-commands')
        .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'access_commands',
        filter: `academy_id=eq.${config.academyId}`,
    }, async (payload) => {
        const command = payload.new;
        // Ignorar comandos que não são para esta catraca
        if (command.turnstile_config_id && command.turnstile_config_id !== config.turnstileConfigId) {
            return;
        }
        // Ignorar comandos já processados
        if (command.status !== 'PENDING')
            return;
        logger_1.logger.info(`📥 Comando recebido: ${command.command_type}`);
        await processCommand(command, adapter, config);
    })
        .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            logger_1.logger.info('✅ Realtime: conectado e escutando');
        }
        else if (status === 'CLOSED') {
            logger_1.logger.warn('⚠️ Realtime: conexão fechada');
        }
        else if (status === 'CHANNEL_ERROR') {
            logger_1.logger.error('❌ Realtime: erro no canal');
        }
    });
}
/**
 * Para o listener
 */
async function stopListener() {
    if (channel) {
        const supabase = (0, client_1.getSupabase)();
        await supabase.removeChannel(channel);
        channel = null;
        logger_1.logger.info('Realtime listener parado');
    }
}
/**
 * Processa um comando recebido do painel web
 */
async function processCommand(command, adapter, config) {
    const supabase = (0, client_1.getSupabase)();
    const startTime = Date.now();
    try {
        // Marcar como "em processamento"
        await supabase
            .from('access_commands')
            .update({ status: 'SENT' })
            .eq('id', command.id);
        // Executar o comando
        switch (command.command_type) {
            case 'GRANT_ACCESS':
                await adapter.grantAccess('IN');
                logger_1.logger.info('✅ Comando GRANT_ACCESS executado');
                break;
            case 'DENY_ACCESS':
                await adapter.denyAccess();
                logger_1.logger.info('🚫 Comando DENY_ACCESS executado');
                break;
            case 'SYNC_USERS':
                logger_1.logger.info('🔄 Comando SYNC_USERS — sincronização iniciada');
                // TODO: Implementar sync de usuários para hardware com storage local
                break;
            case 'REBOOT':
                logger_1.logger.warn('🔄 Comando REBOOT — reiniciando conexão com a catraca');
                await adapter.disconnect();
                await adapter.connect();
                logger_1.logger.info('✅ Catraca reconectada');
                break;
            default:
                logger_1.logger.warn(`Comando desconhecido: ${command.command_type}`);
        }
        // Marcar como concluído
        const elapsed = Date.now() - startTime;
        await supabase
            .from('access_commands')
            .update({
            status: 'COMPLETED',
            result: { elapsed_ms: elapsed, success: true },
            processed_at: new Date().toISOString(),
        })
            .eq('id', command.id);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.logger.error(`Erro ao processar comando ${command.command_type}: ${msg}`);
        // Marcar como falha
        await supabase
            .from('access_commands')
            .update({
            status: 'FAILED',
            result: { error: msg },
            processed_at: new Date().toISOString(),
        })
            .eq('id', command.id);
    }
}
//# sourceMappingURL=listener.js.map