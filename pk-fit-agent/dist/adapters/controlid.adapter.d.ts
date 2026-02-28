import type { TurnstileAdapter, CredentialCallback } from './adapter.interface';
export declare class ControlIdAdapter implements TurnstileAdapter {
    readonly brandName = "Control ID";
    private ip;
    private port;
    private authUser;
    private authPassword;
    private connected;
    private credentialCallback;
    private pollingInterval;
    private lastEventId;
    constructor(ip: string, port: number, authUser: string, authPassword: string);
    private get baseUrl();
    private get authHeaders();
    private request;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    grantAccess(direction: 'IN' | 'OUT'): Promise<void>;
    denyAccess(): Promise<void>;
    onCredentialRead(callback: CredentialCallback): void;
    /**
     * Polling de eventos de acesso.
     * A Control ID notifica eventos via load_objects.
     * Poll a cada 500ms para resposta rápida.
     */
    private startEventPolling;
    getStatus(): Promise<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>;
    getTurnCount(): Promise<{
        in: number;
        out: number;
        total: number;
    }>;
}
//# sourceMappingURL=controlid.adapter.d.ts.map