"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasLocalConfig = hasLocalConfig;
exports.loadLocalConfig = loadLocalConfig;
exports.runSetupWizard = runSetupWizard;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("./logger");
// ==========================================
// SETUP WIZARD — Configuração via Código
// de Pareamento na primeira execução
// ==========================================
// Caminho do arquivo de config local
const CONFIG_FILE = path.resolve(process.cwd(), 'pk-fit-config.json');
/**
 * Verifica se já existe configuração local salva
 */
function hasLocalConfig() {
    return fs.existsSync(CONFIG_FILE);
}
/**
 * Carrega configuração local salva
 */
function loadLocalConfig() {
    try {
        if (!fs.existsSync(CONFIG_FILE))
            return null;
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        logger_1.logger.warn('Erro ao ler configuração local — será necessário parear novamente');
        return null;
    }
}
/**
 * Salva configuração local
 */
function saveLocalConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    logger_1.logger.info(`Configuração salva em: ${CONFIG_FILE}`);
}
/**
 * Prompt interativo no terminal
 */
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
/**
 * Executa o setup wizard interativo
 * Pede URL do Supabase, Service Key e código de pareamento
 */
async function runSetupWizard() {
    logger_1.logger.divider('SETUP — Primeira Configuração');
    console.log('');
    console.log('  Bem-vindo ao PK Fit Pro Agent! 🎉');
    console.log('  Vamos conectar este computador à catraca da academia.');
    console.log('');
    console.log('  Antes de continuar, você precisa:');
    console.log('  1. Ter as credenciais do Supabase (URL e Service Key)');
    console.log('  2. Gerar um código de pareamento no painel web');
    console.log('     (Controle de Acesso → Catracas → Parear Agent)');
    console.log('');
    // 1. URL do Supabase
    const supabaseUrl = await prompt('  📡 URL do Supabase: ');
    if (!supabaseUrl) {
        throw new Error('URL do Supabase é obrigatória');
    }
    // 2. Service Key
    const supabaseKey = await prompt('  🔑 Service Role Key: ');
    if (!supabaseKey) {
        throw new Error('Service Key é obrigatória');
    }
    // 3. Código de pareamento
    console.log('');
    const code = await prompt('  🔗 Código de pareamento (PKF-XXXX-XXXX): ');
    if (!code) {
        throw new Error('Código de pareamento é obrigatório');
    }
    // 4. Validar código via RPC
    logger_1.logger.info('Validando código de pareamento...');
    const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase.rpc('redeem_pairing_code', {
        p_code: code,
    });
    if (error) {
        throw new Error(`Erro ao validar código: ${error.message}`);
    }
    const result = data;
    if (!result.success) {
        throw new Error(result.error || 'Código inválido ou expirado');
    }
    // 5. Montar e salvar configuração
    const localConfig = {
        supabaseUrl,
        supabaseServiceKey: supabaseKey,
        academyId: result.academy_id,
        academyName: result.academy_name || 'Academia',
        turnstileConfigId: result.turnstile_config_id,
        turnstileName: result.turnstile_name || 'Catraca',
        brand: result.brand || 'CONTROL_ID',
        model: result.model || '',
        ipAddress: result.ip_address || '',
        port: result.port || 80,
        authUser: result.auth_user || '',
        authPassword: result.auth_password || '',
        pairedAt: new Date().toISOString(),
    };
    saveLocalConfig(localConfig);
    console.log('');
    logger_1.logger.info('✅ Pareamento concluído com sucesso!');
    logger_1.logger.info(`   Academia: ${localConfig.academyName}`);
    logger_1.logger.info(`   Catraca: ${localConfig.turnstileName} (${localConfig.brand})`);
    logger_1.logger.info(`   IP: ${localConfig.ipAddress}:${localConfig.port}`);
    console.log('');
    return localConfig;
}
//# sourceMappingURL=setup.js.map