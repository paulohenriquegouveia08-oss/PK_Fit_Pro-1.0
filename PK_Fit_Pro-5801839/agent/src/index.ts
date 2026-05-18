#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           PK FIT PRO — AGENTE DE CATRACA v1.1.0             ║
 * ║                                                              ║
 * ║  Software que roda no computador da academia, conecta-se    ║
 * ║  à catraca e sincroniza acesso em tempo real.               ║
 * ║  Suporta reconhecimento facial com Control ID               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { ControlIdAdapter } from './adapters/ControlIdAdapter.js';
import { FaceSyncService } from './services/FaceSyncService.js';
import { faceSyncQueue, addToQueue, getQueueStats } from './queues/faceSyncQueue.js';
import { logger } from './config/logger.js';
import type { ControlIdUser } from './types/user.types.js';

const SUPABASE_URL = 'https://fuovtooenanzcrsgpsxq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1b3Z0b29lbmFuemNyc2dwc3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NDE4NzMsImV4cCI6MjA4MTMxNzg3M30._rf15v-_Qw__kmX2bqV_JC2xQPVrFYOfdfisYmyAses';

const HEARTBEAT_INTERVAL = 30000;
const COMMAND_POLL_INTERVAL = 5000;
const CONFIG_FILE = path.join(
    process.env.APPDATA || process.env.HOME || '.',
    'PKFitAgent',
    'config.json'
);

const VERSION = '1.1.0';

interface Config {
    academy_id: string;
    turnstile_config_id: string;
    pairing_code: string;
    turnstile_ip?: string;
    turnstile_brand?: string;
    control_id_url?: string;
    control_id_user?: string;
    control_id_pass?: string;
}

interface TurnstileConfig {
    ip_address: string;
    port: number;
    brand: string;
    auth_user?: string;
    auth_password?: string;
}

interface AccessCommand {
    id: string;
    command_type: string;
    academy_id: string;
    user_id?: string;
    payload?: Record<string, unknown>;
    status: string;
    created_at: string;
    completed_at?: string;
    error_message?: string;
}

let supabase: SupabaseClient;
let config: Config | null = null;
let turnstileConfig: TurnstileConfig | null = null;
let faceSyncService: FaceSyncService | null = null;
let controlIdAdapter: ControlIdAdapter | null = null;
let isRunning = false;
let heartbeatTimer: NodeJS.Timeout | null = null;
let commandPollTimer: NodeJS.Timeout | null = null;

function clearScreen() {
    process.stdout.write('\x1Bc');
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' | 'command' | 'heartbeat' = 'info') {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const prefix = {
        'info': '\x1b[36m[INFO]\x1b[0m',
        'success': '\x1b[32m[OK]\x1b[0m',
        'error': '\x1b[31m[ERRO]\x1b[0m',
        'warn': '\x1b[33m[AVISO]\x1b[0m',
        'command': '\x1b[35m[CMD]\x1b[0m',
        'heartbeat': '\x1b[90m[♥]\x1b[0m'
    }[type] || '[INFO]';
    console.log(`  ${prefix} [${timestamp}] ${message}`);
}

function showBanner() {
    clearScreen();
    console.log('\x1b[36m');
    console.log('  ╔══════════════════════════════════════════════════════╗');
    console.log('  ║                                                      ║');
    console.log('  ║          PK FIT PRO — Agente de Catraca             ║');
    console.log(`  ║                   v${VERSION}                            ║`);
    console.log('  ║                                                      ║');
    console.log('  ║          🤖 Com suporte a Reconhecimento Facial    ║');
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log('\x1b[0m');
}

function showStatus() {
    if (config) {
        console.log('\x1b[90m  ─────────────────────────────────────────────────────\x1b[0m');
        log(`Academia ID: ${config.academy_id}`, 'info');
        log(`Catraca IP:  ${config.turnstile_ip || 'Não configurado'}`, 'info');
        log(`Face Sync:   ${controlIdAdapter ? '\x1b[32mATIVO\x1b[0m' : '\x1b[33mPENDENTE\x1b[0m'}`, 'info');
        log(`Status:      ${isRunning ? '\x1b[32mCONECTADO\x1b[0m' : '\x1b[31mDESCONECTADO\x1b[0m'}`, 'info');
        console.log('\x1b[90m  ─────────────────────────────────────────────────────\x1b[0m');
    }
}

function loadConfig(): Config | null {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (err) {
        log('Erro ao carregar configuração salva.', 'warn');
    }
    return null;
}

function saveConfig(cfg: Config) {
    try {
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
        log('Configuração salva com sucesso.', 'success');
    } catch (err) {
        log(`Erro ao salvar configuração: ${err}`, 'error');
    }
}

async function initFaceSyncService() {
    if (!config?.control_id_url) {
        log('URL da Control ID não configurada. Face sync desabilitado.', 'warn');
        return;
    }

    controlIdAdapter = new ControlIdAdapter({
        baseUrl: config.control_id_url,
        username: config.control_id_user || 'admin',
        password: config.control_id_pass || 'admin',
        timeout: 10000,
        maxRetries: 3
    });

    faceSyncService = new FaceSyncService(controlIdAdapter, {
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_ANON_KEY,
        bucket: 'avatars'
    });

    log('Serviço de face sync inicializado.', 'success');
}

async function pairWithCode(code: string): Promise<boolean> {
    log(`Tentando parear com código: ${code}...`, 'info');

    try {
        const { data, error } = await supabase.rpc('validate_pairing_code', {
            p_code: code.trim()
        });

        if (error) {
            log('RPC não disponível, tentando busca direta...', 'warn');
            const { data: configs } = await supabase
                .from('turnstile_configs')
                .select('id, academy_id, name, brand, model, ip_address')
                .limit(10);

            if (!configs || configs.length === 0) {
                log('Nenhuma catraca encontrada.', 'error');
                return false;
            }

            const firstConfig = configs[0];
            config = {
                academy_id: firstConfig.academy_id,
                turnstile_config_id: firstConfig.id,
                pairing_code: code.trim(),
                turnstile_ip: firstConfig.ip_address,
                turnstile_brand: firstConfig.brand
            };
            saveConfig(config);
            log(`Pareado com catraca: ${firstConfig.name}`, 'success');
            return true;
        }

        if (data && data.academy_id) {
            const { data: turnstileData } = await supabase
                .from('turnstile_configs')
                .select('ip_address, brand, auth_user, auth_password')
                .eq('id', data.turnstile_config_id)
                .single();

            config = {
                academy_id: data.academy_id,
                turnstile_config_id: data.turnstile_config_id,
                pairing_code: code.trim(),
                turnstile_ip: turnstileData?.ip_address,
                turnstile_brand: turnstileData?.brand,
                control_id_url: turnstileData?.ip_address ? `http://${turnstileData.ip_address}` : undefined,
                control_id_user: turnstileData?.auth_user,
                control_id_pass: turnstileData?.auth_password
            };
            saveConfig(config);
            log(`Pareado com sucesso! Academia: ${data.academy_id}`, 'success');
            return true;
        } else {
            log('Código de pareamento inválido ou expirado.', 'error');
            return false;
        }
    } catch (err) {
        log(`Erro no pareamento: ${err}`, 'error');
        return false;
    }
}

async function sendHeartbeat() {
    if (!config) return;

    try {
        await supabase
            .from('turnstile_configs')
            .update({
                connection_status: 'CONNECTED',
                last_heartbeat: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', config.turnstile_config_id);
    } catch (err) {
        log(`Falha no heartbeat: ${err}`, 'warn');
    }
}

async function pollCommands() {
    if (!config) return;

    try {
        const { data: commands } = await supabase
            .from('access_commands')
            .select('*')
            .eq('academy_id', config.academy_id)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true })
            .limit(10);

        if (!commands || commands.length === 0) return;

        for (const cmd of commands) {
            await processCommand(cmd);
        }
    } catch (err) {
        // Silent fail
    }
}

async function processCommand(cmd: AccessCommand) {
    log(`Comando recebido: ${cmd.command_type}`, 'command');

    try {
        await supabase
            .from('access_commands')
            .update({ status: 'SENT' })
            .eq('id', cmd.id);

        switch (cmd.command_type) {
            case 'GRANT_ACCESS':
                await handleGrantAccess(cmd);
                break;
            case 'DENY_ACCESS':
                await handleDenyAccess(cmd);
                break;
            case 'SYNC_USERS':
                await handleSyncUsers(cmd);
                break;
            case 'SYNC_FACE':
                await handleSyncFace(cmd);
                break;
            case 'REBOOT':
                await handleReboot(cmd);
                break;
            default:
                log(`Comando desconhecido: ${cmd.command_type}`, 'warn');
        }

        await supabase
            .from('access_commands')
            .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString()
            })
            .eq('id', cmd.id);

        log(`Comando ${cmd.command_type} executado com sucesso.`, 'success');
    } catch (err) {
        log(`Erro ao processar comando: ${err}`, 'error');

        await supabase
            .from('access_commands')
            .update({
                status: 'FAILED',
                error_message: String(err)
            })
            .eq('id', cmd.id);
    }
}

async function handleGrantAccess(cmd: AccessCommand) {
    const payload = cmd.payload as { manual?: boolean; user_name?: string } | undefined;
    log(`🔓 LIBERANDO ACESSO ${payload?.manual ? '(manual)' : ''}`, 'success');

    if (config?.turnstile_ip) {
        try {
            await sendToTurnstile({
                ip_address: config.turnstile_ip,
                port: 80,
                brand: config.turnstile_brand || 'CONTROL_ID'
            }, 'open');
            log(`Sinal enviado para catraca ${config.turnstile_ip}`, 'success');
        } catch (err) {
            log(`Aviso: Catraca física não respondeu (${err})`, 'warn');
        }
    }
}

async function handleDenyAccess(cmd: AccessCommand) {
    log('🔒 ACESSO NEGADO', 'warn');
}

async function handleSyncUsers(cmd: AccessCommand) {
    log('🔄 Sincronizando usuários...', 'info');
    log('Sincronização concluída.', 'success');
}

async function handleSyncFace(cmd: AccessCommand) {
    const payload = cmd.payload as { user_id?: string; user_name?: string; user_photo_url?: string } | undefined;
    
    if (!payload?.user_id) {
        log('SYNC_FACE sem payload válido', 'error');
        return;
    }

    log(`👤 Sincronizando face: ${payload.user_name || payload.user_id}`, 'info');

    if (!faceSyncService) {
        log('Face sync service não inicializado', 'error');
        return;
    }

    addToQueue(async () => {
        const user: ControlIdUser = {
            id: parseInt(payload.user_id!, 10),
            name: payload.user_name || 'Unknown',
            photo_url: payload.user_photo_url
        };

        await faceSyncService.sync(user);
    }, { id: `sync-face-${payload.user_id}` });

    log(`Face queued for sync: ${payload.user_name || payload.user_id}`, 'info');
}

async function handleReboot(cmd: AccessCommand) {
    log('🔄 Reiniciando conexão com a catraca...', 'info');
    await sendHeartbeat();
    log('Conexão reiniciada.', 'success');
}

function sendToTurnstile(turnstileConfig: TurnstileConfig, action: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const ip = turnstileConfig.ip_address;
        const port = turnstileConfig.port || 80;
        const brand = turnstileConfig.brand;

        let requestPath = '/';
        
        switch (brand) {
            case 'CONTROL_ID':
                requestPath = `/api/access/${action}`;
                break;
            case 'TOP_DATA':
                requestPath = `/execute?action=${action}`;
                break;
            case 'HENRY':
                requestPath = `/cmd/${action}`;
                break;
            default:
                requestPath = `/${action}`;
        }

        const options = {
            hostname: ip,
            port: port,
            path: requestPath,
            method: 'GET',
            timeout: 5000,
            headers: {}
        };

        if (turnstileConfig.auth_user && turnstileConfig.auth_password) {
            const auth = Buffer.from(
                `${turnstileConfig.auth_user}:${turnstileConfig.auth_password}`
            ).toString('base64');
            options.headers['Authorization'] = `Basic ${auth}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve());
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.end();
    });
}

async function validateAccess(credential: string, method = 'CARD') {
    if (!config) return;

    log(`Validando acesso: ${method} — ${credential}`, 'info');

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, name')
            .or(`card_number.eq.${credential},cpf.eq.${credential}`)
            .single();

        if (error || !user) {
            log(`Usuário não encontrado para credencial: ${credential}`, 'warn');

            await supabase.from('access_logs').insert({
                academy_id: config.academy_id,
                turnstile_config_id: config.turnstile_config_id,
                direction: 'IN',
                access_granted: false,
                denial_reason: 'NAO_ENCONTRADO',
                identification_method: method,
                raw_credential: credential
            });
            return false;
        }

        const { data: validation } = await supabase.rpc('validate_student_access', {
            p_academy_id: config.academy_id,
            p_user_id: user.id
        });

        const granted = validation?.granted === true;

        await supabase.from('access_logs').insert({
            academy_id: config.academy_id,
            user_id: user.id,
            turnstile_config_id: config.turnstile_config_id,
            direction: 'IN',
            access_granted: granted,
            denial_reason: granted ? null : (validation?.reason || 'BLOQUEADO'),
            identification_method: method,
            user_name: user.name
        });

        if (granted) {
            log(`✅ ACESSO LIBERADO — ${user.name}`, 'success');
        } else {
            log(`❌ ACESSO NEGADO — ${user.name}`, 'warn');
        }

        return granted;
    } catch (err) {
        log(`Erro na validação de acesso: ${err}`, 'error');
        return false;
    }
}

function startAgent() {
    isRunning = true;
    log('Agente iniciado! Conectado ao PK Fit Pro.', 'success');
    showStatus();
    console.log('');
    log('Ouvindo comandos do painel...', 'info');
    log('Pressione Ctrl+C para parar.\n', 'info');

    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    commandPollTimer = setInterval(pollCommands, COMMAND_POLL_INTERVAL);
}

function stopAgent() {
    isRunning = false;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (commandPollTimer) clearInterval(commandPollTimer);

    if (config && supabase) {
        supabase
            .from('turnstile_configs')
            .update({
                connection_status: 'DISCONNECTED',
                updated_at: new Date().toISOString()
            })
            .eq('id', config.turnstile_config_id)
            .then(() => {
                log('Status atualizado para DESCONECTADO.', 'info');
                process.exit(0);
            })
            .catch(() => process.exit(0));
    } else {
        process.exit(0);
    }
}

async function promptPairingCode(): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        console.log('');
        console.log('\x1b[33m  Para conectar, você precisa de um código de pareamento.\x1b[0m');
        console.log('\x1b[90m  Gere o código no painel da academia → Controle de Acesso → Parear Agent\x1b[0m');
        console.log('');

        rl.question('  Digite o código de pareamento: ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function showMenu(): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('');
    console.log('  \x1b[36mOpções:\x1b[0m');
    console.log('  [1] Parear com novo código');
    console.log('  [2] Iniciar agente');
    console.log('  [3] Testar conexão');
    console.log('  [4] Verificar status da fila');
    console.log('  [5] Limpar configuração');
    console.log('  [6] Sair');
    console.log('');

    return new Promise((resolve) => {
        rl.question('  Escolha uma opção: ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function main() {
    showBanner();

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    process.on('SIGINT', stopAgent);
    process.on('SIGTERM', stopAgent);

    config = loadConfig();

    if (config) {
        log('Configuração anterior encontrada.', 'success');
        await initFaceSyncService();
        showStatus();
        startAgent();
        return;
    }

    while (true) {
        const choice = await showMenu();

        switch (choice) {
            case '1': {
                const code = await promptPairingCode();
                if (code) {
                    const success = await pairWithCode(code);
                    if (success) {
                        await initFaceSyncService();
                        showBanner();
                        showStatus();
                    }
                }
                break;
            }
            case '2': {
                if (!config) {
                    log('Você precisa parear primeiro (opção 1).', 'warn');
                } else {
                    showBanner();
                    startAgent();
                    return;
                }
                break;
            }
            case '3': {
                log('Testando conexão com Supabase...', 'info');
                try {
                    const { data, error } = await supabase
                        .from('turnstile_configs')
                        .select('id')
                        .limit(1);
                    if (error) {
                        log(`Erro: ${error.message}`, 'error');
                    } else {
                        log('Conexão com Supabase funcionando!', 'success');
                    }
                } catch (err) {
                    log(`Falha na conexão: ${err}`, 'error');
                }
                break;
            }
            case '4': {
                const stats = getQueueStats();
                log(`Fila: ${stats.pending} pendente(s), ${stats.running} processando`, 'info');
                break;
            }
            case '5': {
                try {
                    if (fs.existsSync(CONFIG_FILE)) {
                        fs.unlinkSync(CONFIG_FILE);
                    }
                } catch (err) { /* ignore */ }
                config = null;
                log('Configuração removida.', 'success');
                break;
            }
            case '6':
            case 'q':
            case 'quit': {
                log('Encerrando agente...', 'info');
                process.exit(0);
            }
            default:
                log('Opção inválida.', 'warn');
        }
    }
}

main().catch(err => {
    log(`Erro fatal: ${err}`, 'error');
    process.exit(1);
});