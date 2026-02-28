"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const logger_1 = require("./core/logger");
const setup_1 = require("./core/setup");
const client_1 = require("./supabase/client");
const adapter_factory_1 = require("./adapters/adapter.factory");
const access_controller_1 = require("./core/access-controller");
const heartbeat_1 = require("./core/heartbeat");
const listener_1 = require("./supabase/listener");
const sync_1 = require("./supabase/sync");
// ==========================================
// PK FIT PRO AGENT — Entry Point
// ==========================================
async function main() {
    logger_1.logger.divider('PK FIT PRO AGENT v1.0');
    // ─── 1. CONFIGURAÇÃO (setup wizard ou config salva) ───
    let localConfig = (0, setup_1.loadLocalConfig)();
    if (!localConfig) {
        // Primeira execução → rodar setup wizard
        logger_1.logger.info('Primeira execução detectada — iniciando setup...');
        localConfig = await (0, setup_1.runSetupWizard)();
    }
    else {
        logger_1.logger.info(`✅ Config carregada: ${localConfig.academyName}`);
        logger_1.logger.info(`   Catraca: ${localConfig.turnstileName} (${localConfig.brand})`);
    }
    const config = (0, config_1.configFromLocal)(localConfig);
    logger_1.logger.setLevel(config.logLevel);
    logger_1.logger.info(`IP da catraca: ${config.ip}:${config.port}`);
    logger_1.logger.divider();
    // ─── 2. INICIALIZAR SUPABASE ───
    logger_1.logger.info('Conectando ao Supabase...');
    (0, client_1.initSupabase)(config);
    // ─── 3. CRIAR ADAPTADOR DA CATRACA ───
    logger_1.logger.info(`Criando adaptador: ${config.brand}...`);
    const adapter = (0, adapter_factory_1.createAdapter)(config);
    // ─── 4. CONECTAR À CATRACA ───
    logger_1.logger.info('Conectando à catraca...');
    await adapter.connect();
    // ─── 5. INICIAR HEARTBEAT ───
    (0, heartbeat_1.startHeartbeat)(config);
    // ─── 6. VERIFICAR COMANDOS PENDENTES ───
    await (0, sync_1.processPendingCommands)(config);
    // ─── 7. INICIAR LISTENER DE COMANDOS ───
    (0, listener_1.startListener)(config, adapter);
    // ─── 8. INICIAR ACCESS CONTROLLER ───
    const controller = new access_controller_1.AccessController(adapter, config);
    controller.start();
    logger_1.logger.divider();
    logger_1.logger.info('🚀 Agent rodando! Aguardando acessos...');
    logger_1.logger.info('Pressione Ctrl+C para encerrar');
    logger_1.logger.divider();
    // ─── GRACEFUL SHUTDOWN ───
    const shutdown = async (signal) => {
        logger_1.logger.divider();
        logger_1.logger.info(`Sinal ${signal} recebido — encerrando...`);
        (0, heartbeat_1.stopHeartbeat)();
        await (0, listener_1.stopListener)();
        await adapter.disconnect();
        await (0, heartbeat_1.markDisconnected)(config);
        logger_1.logger.info('👋 Agent encerrado com sucesso');
        process.exit(0);
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    // Manter processo vivo
    await new Promise(() => { });
}
// ─── EXECUTAR ───
main().catch((error) => {
    logger_1.logger.error(`❌ Erro fatal: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map