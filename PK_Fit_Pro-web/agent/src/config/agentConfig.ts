import fs from 'fs';
import path from 'path';

export interface AgentConfig {
    academyId: string;
    turnstileConfigId: string;
    pairingCode: string;
    supabaseUrl: string;
    supabaseKey: string;
    turnstile: {
        ip: string;
        port: number;
        brand: string;
        authUser?: string;
        authPassword?: string;
    };
    controlId?: {
        url: string;
        username: string;
        password: string;
    };
    sync?: {
        enabled: boolean;
        interval?: number;
    };
}

const DEFAULT_CONFIG: AgentConfig = {
    academyId: '',
    turnstileConfigId: '',
    pairingCode: '',
    supabaseUrl: '',
    supabaseKey: '',
    turnstile: {
        ip: '',
        port: 80,
        brand: 'CONTROL_ID'
    }
};

export class AgentConfigManager {
    private config: AgentConfig;
    private configPath: string;

    constructor(configDir?: string) {
        this.configPath = path.join(
            configDir || process.env.APPDATA || process.env.HOME || '.',
            'PKFitAgent',
            'agent-config.json'
        );
        this.config = this.load();
    }

    private load(): AgentConfig {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
        return { ...DEFAULT_CONFIG };
    }

    save(config: Partial<AgentConfig>): void {
        this.config = { ...this.config, ...config };
        
        const dir = path.dirname(this.configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    }

    get(): AgentConfig {
        return { ...this.config };
    }

    getControlIdConfig() {
        if (!this.config.controlId) {
            const turnstile = this.config.turnstile;
            if (turnstile.ip) {
                return {
                    url: `http://${turnstile.ip}`,
                    username: turnstile.authUser || 'admin',
                    password: turnstile.authPassword || 'admin'
                };
            }
        }
        return this.config.controlId;
    }

    isFaceSyncEnabled(): boolean {
        return this.config.sync?.enabled ?? false;
    }

    clear(): void {
        try {
            if (fs.existsSync(this.configPath)) {
                fs.unlinkSync(this.configPath);
            }
        } catch (error) {
            console.error('Failed to clear config:', error);
        }
        this.config = { ...DEFAULT_CONFIG };
    }
}