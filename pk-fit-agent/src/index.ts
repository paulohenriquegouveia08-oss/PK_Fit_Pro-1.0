import { configFromLocal } from './config';
import { logger } from './core/logger';
import { hasLocalConfig, loadLocalConfig, runSetupWizard } from './core/setup';
import { initSupabase } from './supabase/client';
import { createAdapter } from './adapters/adapter.factory';
import { AccessController } from './core/access-controller';
import { startHeartbeat, stopHeartbeat, markDisconnected } from './core/heartbeat';
import { startListener, stopListener } from './supabase/listener';
import { processPendingCommands } from './supabase/sync';

// ==========================================
// PK FIT PRO AGENT — Entry Point
// ==========================================

async function main(): Promise<void> {
    logger.divider('PK FIT PRO AGENT v1.0');

    // ─── 1. CONFIGURAÇÃO (setup wizard ou config salva) ───
    let localConfig = loadLocalConfig();

    if (!localConfig) {
        // Primeira execução → rodar setup wizard
        logger.info('Primeira execução detectada — iniciando setup...');
        localConfig = await runSetupWizard();
    } else {
        logger.info(`✅ Config carregada: ${localConfig.academyName}`);
        logger.info(`   Catraca: ${localConfig.turnstileName} (${localConfig.brand})`);
    }

    const config = configFromLocal(localConfig);
    logger.setLevel(config.logLevel);
    logger.info(`IP da catraca: ${config.ip}:${config.port}`);
    logger.divider();

    // ─── 2. INICIALIZAR SUPABASE ───
    logger.info('Conectando ao Supabase...');
    initSupabase(config);

    // ─── 3. CRIAR ADAPTADOR DA CATRACA ───
    logger.info(`Criando adaptador: ${config.brand}...`);
    const adapter = createAdapter(config);

    // ─── 4. CONECTAR À CATRACA ───
    logger.info('Conectando à catraca...');
    await adapter.connect();

    // ─── 5. INICIAR HEARTBEAT ───
    startHeartbeat(config);

    // ─── 6. VERIFICAR COMANDOS PENDENTES ───
    await processPendingCommands(config);

    // ─── 7. INICIAR LISTENER DE COMANDOS ───
    startListener(config, adapter);

    // ─── 8. INICIAR ACCESS CONTROLLER ───
    const controller = new AccessController(adapter, config);
    controller.start();

    logger.divider();
    logger.info('🚀 Agent rodando! Aguardando acessos...');
    logger.info('Pressione Ctrl+C para encerrar');
    logger.divider();

    // ─── GRACEFUL SHUTDOWN ───
    const shutdown = async (signal: string): Promise<void> => {
        logger.divider();
        logger.info(`Sinal ${signal} recebido — encerrando...`);

        stopHeartbeat();
        await stopListener();
        await adapter.disconnect();
        await markDisconnected(config);

        logger.info('👋 Agent encerrado com sucesso');
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Manter processo vivo
    await new Promise(() => { });
}

// ─── EXECUTAR ───
main().catch((error) => {
    logger.error(`❌ Erro fatal: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
});
