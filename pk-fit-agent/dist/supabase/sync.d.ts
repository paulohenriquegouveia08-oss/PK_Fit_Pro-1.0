import type { AgentConfig } from '../config';
/**
 * Verifica se há comandos pendentes que não foram processados
 * (ex: se o Agent estava offline quando o comando foi enviado)
 */
export declare function processPendingCommands(config: AgentConfig): Promise<number>;
/**
 * Busca a configuração mais recente da catraca no banco
 * Útil para detectar mudanças feitas via painel web
 */
export declare function fetchLatestConfig(config: AgentConfig): Promise<{
    is_active: boolean;
    brand: string;
    ip_address: string;
    port: number;
} | null>;
/**
 * Verifica se a catraca foi desativada no painel web
 * Se sim, o Agent deve parar de processar
 */
export declare function isTurnstileActive(config: AgentConfig): Promise<boolean>;
//# sourceMappingURL=sync.d.ts.map