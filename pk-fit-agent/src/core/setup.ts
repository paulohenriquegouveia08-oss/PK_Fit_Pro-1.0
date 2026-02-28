import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

// ==========================================
// SETUP WIZARD — Configuração via Código
// de Pareamento na primeira execução
// ==========================================

// Caminho do arquivo de config local
const CONFIG_FILE = path.resolve(process.cwd(), 'pk-fit-config.json');

export interface LocalConfig {
    supabaseUrl: string;
    supabaseServiceKey: string;
    academyId: string;
    academyName: string;
    turnstileConfigId: string;
    turnstileName: string;
    brand: string;
    model: string;
    ipAddress: string;
    port: number;
    authUser: string;
    authPassword: string;
    pairedAt: string;
}

/**
 * Verifica se já existe configuração local salva
 */
export function hasLocalConfig(): boolean {
    return fs.existsSync(CONFIG_FILE);
}

/**
 * Carrega configuração local salva
 */
export function loadLocalConfig(): LocalConfig | null {
    try {
        if (!fs.existsSync(CONFIG_FILE)) return null;
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(raw) as LocalConfig;
    } catch {
        logger.warn('Erro ao ler configuração local — será necessário parear novamente');
        return null;
    }
}

/**
 * Salva configuração local
 */
function saveLocalConfig(config: LocalConfig): void {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    logger.info(`Configuração salva em: ${CONFIG_FILE}`);
}

/**
 * Prompt interativo no terminal
 */
function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(question, (answer: string) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/**
 * Executa o setup wizard interativo
 * Pede URL do Supabase, Service Key e código de pareamento
 */
export async function runSetupWizard(): Promise<LocalConfig> {
    logger.divider('SETUP — Primeira Configuração');

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
    logger.info('Validando código de pareamento...');

    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.rpc('redeem_pairing_code', {
        p_code: code,
    });

    if (error) {
        throw new Error(`Erro ao validar código: ${error.message}`);
    }

    const result = data as {
        success: boolean;
        error?: string;
        academy_id?: string;
        academy_name?: string;
        turnstile_config_id?: string;
        turnstile_name?: string;
        brand?: string;
        model?: string;
        ip_address?: string;
        port?: number;
        auth_user?: string;
        auth_password?: string;
    };

    if (!result.success) {
        throw new Error(result.error || 'Código inválido ou expirado');
    }

    // 5. Montar e salvar configuração
    const localConfig: LocalConfig = {
        supabaseUrl,
        supabaseServiceKey: supabaseKey,
        academyId: result.academy_id!,
        academyName: result.academy_name || 'Academia',
        turnstileConfigId: result.turnstile_config_id!,
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
    logger.info('✅ Pareamento concluído com sucesso!');
    logger.info(`   Academia: ${localConfig.academyName}`);
    logger.info(`   Catraca: ${localConfig.turnstileName} (${localConfig.brand})`);
    logger.info(`   IP: ${localConfig.ipAddress}:${localConfig.port}`);
    console.log('');

    return localConfig;
}
