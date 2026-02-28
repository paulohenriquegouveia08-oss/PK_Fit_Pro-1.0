import type { AgentConfig } from '../config';
/**
 * Inicia o heartbeat — atualiza turnstile_configs a cada intervalo
 */
export declare function startHeartbeat(config: AgentConfig): void;
/**
 * Para o heartbeat
 */
export declare function stopHeartbeat(): void;
/**
 * Marca a catraca como desconectada no banco
 * Chamado ao parar o Agent (graceful shutdown)
 */
export declare function markDisconnected(config: AgentConfig): Promise<void>;
//# sourceMappingURL=heartbeat.d.ts.map