import type { LocalConfig } from './core/setup';
export type TurnstileBrand = 'CONTROL_ID' | 'TOP_DATA' | 'HENRY';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface AgentConfig {
    supabaseUrl: string;
    supabaseServiceKey: string;
    academyId: string;
    academyName: string;
    turnstileConfigId: string;
    brand: TurnstileBrand;
    ip: string;
    port: number;
    authUser: string;
    authPassword: string;
    heartbeatInterval: number;
    logLevel: LogLevel;
}
/**
 * Converte a config local (salva pelo setup wizard)
 * na AgentConfig usada por todos os módulos
 */
export declare function configFromLocal(local: LocalConfig): AgentConfig;
//# sourceMappingURL=config.d.ts.map