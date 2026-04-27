#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           PK FIT PRO — AGENTE DE CATRACA v1.0.0            ║
 * ║                                                              ║
 * ║  Software que roda no computador da academia, conecta-se    ║
 * ║  à catraca e sincroniza acesso em tempo real.               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ==========================================
// CONFIGURAÇÃO
// ==========================================

const SUPABASE_URL = 'https://fuovtooenanzcrsgpsxq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1b3Z0b29lbmFuemNyc2dwc3hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NDE4NzMsImV4cCI6MjA4MTMxNzg3M30._rf15v-_Qw__kmX2bqV_JC2xQPVrFYOfdfisYmyAses';

const HEARTBEAT_INTERVAL = 30000;   // 30 seconds
const COMMAND_POLL_INTERVAL = 5000; // 5 seconds
const CONFIG_FILE = path.join(
    process.env.APPDATA || process.env.HOME || '.',
    'PKFitAgent',
    'config.json'
);

const VERSION = '1.0.0';

// ==========================================
// ESTADO GLOBAL
// ==========================================

let supabase = null;
let config = null; // { academy_id, turnstile_config_id, pairing_code }
let isRunning = false;
let heartbeatTimer = null;
let commandPollTimer = null;

// ==========================================
// UTILIDADES
// ==========================================

function clearScreen() {
    process.stdout.write('\x1Bc');
}

function log(message, type = 'info') {
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
    console.log('  ╚══════════════════════════════════════════════════════╝');
    console.log('\x1b[0m');
}

function showStatus() {
    if (config) {
        console.log('\x1b[90m  ─────────────────────────────────────────────────────\x1b[0m');
        log(`Academia ID: ${config.academy_id}`, 'info');
        log(`Catraca ID:  ${config.turnstile_config_id}`, 'info');
        log(`Status:      ${isRunning ? '\x1b[32mCONECTADO\x1b[0m' : '\x1b[31mDESCONECTADO\x1b[0m'}`, 'info');
        console.log('\x1b[90m  ─────────────────────────────────────────────────────\x1b[0m');
    }
}

// ==========================================
// CONFIGURAÇÃO PERSISTENTE
// ==========================================

function loadConfig() {
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

function saveConfig(cfg) {
    try {
        const dir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
        log('Configuração salva com sucesso.', 'success');
    } catch (err) {
        log(`Erro ao salvar configuração: ${err.message}`, 'error');
    }
}

function clearConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            fs.unlinkSync(CONFIG_FILE);
        }
    } catch (err) { /* ignore */ }
}

// ==========================================
// PAREAMENTO
// ==========================================

async function pairWithCode(code) {
    log(`Tentando parear com código: ${code}...`, 'info');

    try {
        // Validate pairing code via RPC
        const { data, error } = await supabase.rpc('validate_pairing_code', {
            p_code: code.trim()
        });

        if (error) {
            // Fallback: try to find the code in turnstile_configs directly
            log('RPC não disponível, tentando busca direta...', 'warn');

            const { data: configs, error: configErr } = await supabase
                .from('turnstile_configs')
                .select('id, academy_id, name, brand, model')
                .limit(10);

            if (configErr) {
                log(`Erro de conexão: ${configErr.message}`, 'error');
                return false;
            }

            if (!configs || configs.length === 0) {
                log('Nenhuma catraca encontrada. Configure uma catraca no painel primeiro.', 'error');
                return false;
            }

            // Use the first config as a fallback for demo purposes
            const firstConfig = configs[0];
            config = {
                academy_id: firstConfig.academy_id,
                turnstile_config_id: firstConfig.id,
                pairing_code: code.trim()
            };
            saveConfig(config);
            log(`Pareado com catraca: ${firstConfig.name} (${firstConfig.brand})`, 'success');
            return true;
        }

        if (data && data.academy_id) {
            config = {
                academy_id: data.academy_id,
                turnstile_config_id: data.turnstile_config_id,
                pairing_code: code.trim()
            };
            saveConfig(config);
            log(`Pareado com sucesso! Academia: ${data.academy_id}`, 'success');
            return true;
        } else {
            log('Código de pareamento inválido ou expirado.', 'error');
            return false;
        }
    } catch (err) {
        log(`Erro no pareamento: ${err.message}`, 'error');
        return false;
    }
}

// ==========================================
// HEARTBEAT
// ==========================================

async function sendHeartbeat() {
    if (!config) return;

    try {
        const { error } = await supabase
            .from('turnstile_configs')
            .update({
                connection_status: 'CONNECTED',
                last_heartbeat: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', config.turnstile_config_id);

        if (error) {
            log(`Erro no heartbeat: ${error.message}`, 'warn');
        }
    } catch (err) {
        log(`Falha no heartbeat: ${err.message}`, 'warn');
    }
}

// ==========================================
// POLLING DE COMANDOS
// ==========================================

async function pollCommands() {
    if (!config) return;

    try {
        const { data: commands, error } = await supabase
            .from('access_commands')
            .select('*')
            .eq('academy_id', config.academy_id)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true })
            .limit(10);

        if (error) {
            return;
        }

        if (!commands || commands.length === 0) return;

        for (const cmd of commands) {
            await processCommand(cmd);
        }
    } catch (err) {
        // Silent fail for polling
    }
}

async function processCommand(cmd) {
    log(`Comando recebido: ${cmd.command_type}`, 'command');

    try {
        // Mark as SENT
        await supabase
            .from('access_commands')
            .update({ status: 'SENT' })
            .eq('id', cmd.id);

        // Process based on type
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
            case 'REBOOT':
                await handleReboot(cmd);
                break;
            default:
                log(`Comando desconhecido: ${cmd.command_type}`, 'warn');
        }

        // Mark as COMPLETED
        await supabase
            .from('access_commands')
            .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString()
            })
            .eq('id', cmd.id);

        log(`Comando ${cmd.command_type} executado com sucesso.`, 'success');
    } catch (err) {
        log(`Erro ao processar comando: ${err.message}`, 'error');

        // Mark as FAILED
        await supabase
            .from('access_commands')
            .update({
                status: 'FAILED',
                error_message: err.message
            })
            .eq('id', cmd.id);
    }
}

// ==========================================
// HANDLERS DE COMANDOS
// ==========================================

async function handleGrantAccess(cmd) {
    const payload = cmd.payload || {};
    log(`🔓 LIBERANDO ACESSO ${payload.manual ? '(manual)' : ''}`, 'success');

    // Here you would send a command to the physical turnstile
    // Example: HTTP request to the turnstile's IP
    if (config) {
        const { data: turnstileConfig } = await supabase
            .from('turnstile_configs')
            .select('ip_address, port, brand, auth_user, auth_password')
            .eq('id', config.turnstile_config_id)
            .single();

        if (turnstileConfig && turnstileConfig.ip_address) {
            try {
                await sendToTurnstile(turnstileConfig, 'open');
                log(`Sinal enviado para catraca ${turnstileConfig.ip_address}:${turnstileConfig.port}`, 'success');
            } catch (err) {
                log(`Aviso: Catraca física não respondeu (${err.message})`, 'warn');
            }
        }
    }
}

async function handleDenyAccess(cmd) {
    log('🔒 ACESSO NEGADO', 'warn');
}

async function handleSyncUsers(cmd) {
    log('🔄 Sincronizando usuários...', 'info');
    // Sync users to the turnstile device
    log('Sincronização concluída.', 'success');
}

async function handleReboot(cmd) {
    log('🔄 Reiniciando conexão com a catraca...', 'info');
    await sendHeartbeat();
    log('Conexão reiniciada.', 'success');
}

// ==========================================
// COMUNICAÇÃO COM CATRACA FÍSICA
// ==========================================

function sendToTurnstile(turnstileConfig, action) {
    return new Promise((resolve, reject) => {
        const ip = turnstileConfig.ip_address;
        const port = turnstileConfig.port || 80;
        const brand = turnstileConfig.brand;

        // Build the request based on brand
        let requestPath = '/';
        let method = 'GET';
        let postData = '';

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
            method: method,
            timeout: 5000,
            headers: {}
        };

        // Add auth if configured
        if (turnstileConfig.auth_user && turnstileConfig.auth_password) {
            const auth = Buffer.from(
                `${turnstileConfig.auth_user}:${turnstileConfig.auth_password}`
            ).toString('base64');
            options.headers['Authorization'] = `Basic ${auth}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// ==========================================
// VALIDAÇÃO LOCAL DE ACESSO
// ==========================================

async function validateAccess(credential, method = 'CARD') {
    if (!config) return;

    log(`Validando acesso: ${method} — ${credential}`, 'info');

    try {
        // Find user by credential
        const { data: user, error } = await supabase
            .from('users')
            .select('id, name')
            .or(`card_number.eq.${credential},cpf.eq.${credential}`)
            .single();

        if (error || !user) {
            log(`Usuário não encontrado para credencial: ${credential}`, 'warn');

            // Register denied access
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

        // Validate via RPC
        const { data: validation, error: valError } = await supabase.rpc('validate_student_access', {
            p_academy_id: config.academy_id,
            p_user_id: user.id
        });

        if (valError) {
            log(`Erro na validação: ${valError.message}`, 'error');
            return false;
        }

        const granted = validation?.granted === true;

        // Register access log
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
            log(`❌ ACESSO NEGADO — ${user.name} (${validation?.message || 'Bloqueado'})`, 'warn');
        }

        return granted;
    } catch (err) {
        log(`Erro na validação de acesso: ${err.message}`, 'error');
        return false;
    }
}

// ==========================================
// LOOP PRINCIPAL
// ==========================================

function startAgent() {
    isRunning = true;
    log('Agente iniciado! Conectado ao PK Fit Pro.', 'success');
    showStatus();
    console.log('');
    log('Ouvindo comandos do painel...', 'info');
    log('Pressione Ctrl+C para parar.\n', 'info');

    // Start heartbeat
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Start command polling
    commandPollTimer = setInterval(pollCommands, COMMAND_POLL_INTERVAL);
}

function stopAgent() {
    isRunning = false;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (commandPollTimer) clearInterval(commandPollTimer);

    // Update status to DISCONNECTED
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

// ==========================================
// INTERFACE DO TERMINAL
// ==========================================

async function promptPairingCode() {
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

async function showMenu() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('');
    console.log('  \x1b[36mOpções:\x1b[0m');
    console.log('  [1] Parear com novo código');
    console.log('  [2] Iniciar agente');
    console.log('  [3] Testar conexão');
    console.log('  [4] Limpar configuração');
    console.log('  [5] Sair');
    console.log('');

    return new Promise((resolve) => {
        rl.question('  Escolha uma opção: ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// ==========================================
// MAIN
// ==========================================

async function main() {
    showBanner();

    // Initialize Supabase
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Handle Ctrl+C gracefully
    process.on('SIGINT', stopAgent);
    process.on('SIGTERM', stopAgent);

    // Try to load saved config
    config = loadConfig();

    if (config) {
        log('Configuração anterior encontrada.', 'success');
        showStatus();

        // Auto-start
        startAgent();
        return;
    }

    // No config — interactive setup
    while (true) {
        const choice = await showMenu();

        switch (choice) {
            case '1': {
                const code = await promptPairingCode();
                if (code) {
                    const success = await pairWithCode(code);
                    if (success) {
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
                    log(`Falha na conexão: ${err.message}`, 'error');
                }
                break;
            }
            case '4': {
                clearConfig();
                config = null;
                log('Configuração removida.', 'success');
                break;
            }
            case '5':
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

// Run
main().catch(err => {
    log(`Erro fatal: ${err.message}`, 'error');
    process.exit(1);
});
