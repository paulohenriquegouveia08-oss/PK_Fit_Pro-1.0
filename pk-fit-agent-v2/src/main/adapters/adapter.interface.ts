// ==========================================
// INTERFACE BASE — Adaptador de Catraca
// Cada marca (Control ID, Top Data, Henry)
// implementa esta interface.
// ==========================================

export interface CredentialEvent {
    /** Tipo de credencial lida */
    type: 'BIOMETRIC' | 'CARD' | 'QR_CODE' | 'FACIAL';
    /** Valor bruto da credencial (hash, número do cartão, etc) */
    rawValue: string;
    /** Momento da leitura */
    timestamp: Date;
}

export type CredentialCallback = (event: CredentialEvent) => void;

export interface TurnstileAdapter {
    /** Nome da marca para logs */
    readonly brandName: string;

    /**
     * Conecta ao hardware da catraca.
     * Deve resolver quando a conexão for estabelecida com sucesso.
     */
    connect(): Promise<void>;

    /**
     * Desconecta do hardware.
     */
    disconnect(): Promise<void>;

    /**
     * Retorna se o adapter está ativamente conectado ao hardware.
     */
    isConnected(): boolean;

    /**
     * Libera a catraca para o aluno passar.
     * @param direction Sentido de giro
     */
    grantAccess(direction: 'IN' | 'OUT'): Promise<void>;

    /**
     * Bloqueia/nega acesso — a catraca não gira.
     * Pode acionar LED vermelho / buzzer, dependendo do hardware.
     */
    denyAccess(): Promise<void>;

    /**
     * Registra callback que será chamado sempre que uma credencial for lida.
     * O Agent usa isso para iniciar o fluxo de validação de acesso.
     */
    onCredentialRead(callback: CredentialCallback): void;

    /**
     * Retorna status atual da conexão com o hardware.
     */
    getStatus(): Promise<'CONNECTED' | 'DISCONNECTED' | 'ERROR'>;

    /**
     * Sincroniza um usuário e seu rosto/facial com o hardware.
     */
    syncUserFace?(userId: string, name: string, photoUrl: string): Promise<void>;

    /**
     * Remove um usuário do hardware.
     */
    removeUser?(userId: string): Promise<void>;

    /**
     * (Opcional) Retorna contagem de giros da catraca.
     */
    getTurnCount?(): Promise<{ in: number; out: number; total: number }>;
}
