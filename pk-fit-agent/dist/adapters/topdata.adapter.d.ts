import type { TurnstileAdapter, CredentialCallback } from './adapter.interface';
export declare class TopDataAdapter implements TurnstileAdapter {
    readonly brandName = "Top Data";
    private ip;
    private port;
    private socket;
    private connected;
    private credentialCallback;
    private reconnectTimer;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private readonly reconnectDelay;
    private dataBuffer;
    constructor(ip: string, port: number, _authUser: string, _authPassword: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    private scheduleReconnect;
    private sendCommand;
    private handleIncomingData;
    private processPacket;
    grantAccess(direction: 'IN' | 'OUT'): Promise<void>;
    denyAccess(): Promise<void>;
    onCredentialRead(callback: CredentialCallback): void;
    getStatus(): Promise<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>;
}
//# sourceMappingURL=topdata.adapter.d.ts.map