import type { TurnstileAdapter, CredentialCallback } from './adapter.interface';
export declare class HenryAdapter implements TurnstileAdapter {
    readonly brandName = "Henry";
    private ip;
    private port;
    private authUser;
    private authPassword;
    private connected;
    private credentialCallback;
    private pollingInterval;
    private tcpSocket;
    private tcpConnected;
    private reconnectTimer;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private readonly reconnectDelay;
    private readonly tcpPort;
    private dataBuffer;
    private lastEventId;
    constructor(ip: string, port: number, authUser: string, authPassword: string);
    private get baseUrl();
    private get authHeaders();
    private httpRequest;
    connect(): Promise<void>;
    private connectTcp;
    private scheduleTcpReconnect;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    private handleTcpData;
    private processTcpPacket;
    private startHttpPolling;
    grantAccess(direction: 'IN' | 'OUT'): Promise<void>;
    denyAccess(): Promise<void>;
    onCredentialRead(callback: CredentialCallback): void;
    getStatus(): Promise<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>;
}
//# sourceMappingURL=henry.adapter.d.ts.map