import type { TurnstileAdapter } from '../adapters/adapter.interface';
import type { AgentConfig } from '../config';
export declare class AccessController {
    private adapter;
    private config;
    private processing;
    constructor(adapter: TurnstileAdapter, config: AgentConfig);
    /**
     * Inicia o controller — registra o callback de credencial no adapter
     */
    start(): void;
    /**
     * Handler principal — chamado quando alguém encosta cartão/biometria
     * PERFORMANCE CRÍTICA: cada ms conta aqui
     */
    private handleCredentialEvent;
    /**
     * Resolve credencial bruta → user_id
     * Usa cache local para evitar buscas no banco
     */
    private resolveUserId;
    /**
     * Chama a RPC validate_student_access no Supabase
     * RÁPIDO: executa em uma única query SQL
     */
    private validateAccess;
    /**
     * Registra log de acesso no Supabase (assíncrono)
     * Não bloqueia a liberação da catraca
     */
    private logAccessAsync;
}
//# sourceMappingURL=access-controller.d.ts.map