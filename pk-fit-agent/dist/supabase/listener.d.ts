import type { AgentConfig } from '../config';
import type { TurnstileAdapter } from '../adapters/adapter.interface';
/**
 * Inicia o listener que escuta novos comandos via Supabase Realtime
 */
export declare function startListener(config: AgentConfig, adapter: TurnstileAdapter): void;
/**
 * Para o listener
 */
export declare function stopListener(): Promise<void>;
//# sourceMappingURL=listener.d.ts.map