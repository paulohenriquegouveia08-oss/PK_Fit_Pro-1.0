import type { AgentConfig } from '../config';
import type { TurnstileAdapter } from './adapter.interface';
/**
 * Factory — cria o adaptador correto baseado na marca configurada.
 * O Agent não precisa saber qual marca é, só usa a interface.
 */
export declare function createAdapter(config: AgentConfig): TurnstileAdapter;
//# sourceMappingURL=adapter.factory.d.ts.map