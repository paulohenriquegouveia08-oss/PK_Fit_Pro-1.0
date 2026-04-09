import * as net from 'net';
import type { TurnstileAdapter, CredentialCallback, CredentialEvent } from './adapter.interface';
import { logger } from '../core/logger';

// ==========================================
// TOP DATA ADAPTER — TCP Socket Communication
// Comunicação via TCP com equipamentos Top Data
// (Inner Acesso, Revolution, etc.)
// ==========================================

// Comandos TCP conhecidos do protocolo Top Data (EasyInner)
const TD_COMMANDS = {
    // Handshake / status
    PING: Buffer.from([0x02, 0x00, 0x01, 0x01, 0x03]),         // ENQ - verifica conexão
    GET_STATUS: Buffer.from([0x02, 0x00, 0x01, 0x05, 0x03]),    // Status do equipamento

    // Controle de acesso
    GRANT_CLOCKWISE: Buffer.from([0x02, 0x00, 0x02, 0x03, 0x01, 0x03]),  // Liberar sentido horário (entrada)
    GRANT_ANTICLOCKWISE: Buffer.from([0x02, 0x00, 0x02, 0x03, 0x02, 0x03]), // Liberar anti-horário (saída)
    DENY: Buffer.from([0x02, 0x00, 0x02, 0x03, 0x00, 0x03]),   // Negar acesso (buzzer)
};

// Eventos recebidos do equipamento
const TD_EVENTS = {
    CARD_READ: 0x04,       // Leitura de cartão
    BIOMETRIC_READ: 0x07,  // Leitura biométrica
    TURNSTILE_TURN: 0x06,  // Giro da catraca detectado
};

export class TopDataAdapter implements TurnstileAdapter {
    readonly brandName = 'Top Data';

    private ip: string;
    private port: number;
    private socket: net.Socket | null = null;
    private connected: boolean = false;
    private credentialCallback: CredentialCallback | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts = 10;
    private readonly reconnectDelay = 5000; // 5 segundos entre reconexões
    private dataBuffer: Buffer = Buffer.alloc(0);

    constructor(ip: string, port: number, _authUser: string, _authPassword: string) {
        this.ip = ip;
        this.port = port || 3570; // Porta padrão dos equipamentos Top Data
    }

    // ==========================================
    // CONEXÃO TCP
    // ==========================================

    async connect(): Promise<void> {
        logger.info(`[Top Data] Conectando via TCP em ${this.ip}:${this.port}...`);

        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout de conexão (10s)'));
            }, 10000);

            this.socket = net.createConnection({
                host: this.ip,
                port: this.port,
            });

            this.socket.on('connect', () => {
                clearTimeout(timeout);
                this.connected = true;
                this.reconnectAttempts = 0;
                logger.info(`[Top Data] ✅ Conectado com sucesso!`);

                // Enviar ping inicial para confirmar comunicação
                this.sendCommand(TD_COMMANDS.PING);
                resolve();
            });

            this.socket.on('data', (data: Buffer) => {
                this.handleIncomingData(data);
            });

            this.socket.on('error', (error: Error) => {
                logger.error(`[Top Data] ❌ Erro de conexão: ${error.message}`);
                if (!this.connected) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            this.socket.on('close', () => {
                const wasConnected = this.connected;
                this.connected = false;
                logger.warn(`[Top Data] Conexão fechada`);

                if (wasConnected) {
                    this.scheduleReconnect();
                }
            });
        });
    }

    async disconnect(): Promise<void> {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.destroy();
            this.socket = null;
        }

        this.connected = false;
        logger.info(`[Top Data] Desconectado`);
    }

    isConnected(): boolean {
        return this.connected;
    }

    // ==========================================
    // RECONEXÃO AUTOMÁTICA
    // ==========================================

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error(`[Top Data] ❌ Máximo de tentativas de reconexão atingido (${this.maxReconnectAttempts})`);
            return;
        }

        this.reconnectAttempts++;
        logger.info(`[Top Data] Reconectando em ${this.reconnectDelay / 1000}s... (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connect();
                logger.info(`[Top Data] ✅ Reconectado com sucesso!`);
            } catch (error) {
                logger.error(`[Top Data] Falha na reconexão: ${error instanceof Error ? error.message : error}`);
            }
        }, this.reconnectDelay);
    }

    // ==========================================
    // ENVIO DE COMANDOS TCP
    // ==========================================

    private sendCommand(command: Buffer): void {
        if (!this.socket || !this.connected) {
            logger.warn(`[Top Data] Tentativa de enviar comando sem conexão`);
            return;
        }

        try {
            this.socket.write(command);
            logger.debug(`[Top Data] Comando enviado: [${command.toString('hex')}]`);
        } catch (error) {
            logger.error(`[Top Data] Erro ao enviar comando: ${error instanceof Error ? error.message : error}`);
        }
    }

    // ==========================================
    // PROCESSAMENTO DE DADOS RECEBIDOS
    // ==========================================

    private handleIncomingData(data: Buffer): void {
        // Acumular dados no buffer (pacotes podem chegar fragmentados)
        this.dataBuffer = Buffer.concat([this.dataBuffer, data]);

        // Processar pacotes completos (delimitados por STX=0x02 e ETX=0x03)
        while (this.dataBuffer.length > 0) {
            const startIdx = this.dataBuffer.indexOf(0x02); // STX
            if (startIdx === -1) {
                this.dataBuffer = Buffer.alloc(0);
                break;
            }

            const endIdx = this.dataBuffer.indexOf(0x03, startIdx); // ETX
            if (endIdx === -1) {
                // Pacote incompleto, aguardar mais dados
                break;
            }

            // Extrair pacote completo
            const packet = this.dataBuffer.subarray(startIdx, endIdx + 1);
            this.dataBuffer = this.dataBuffer.subarray(endIdx + 1);

            this.processPacket(packet);
        }
    }

    private processPacket(packet: Buffer): void {
        if (packet.length < 4) return;

        const commandByte = packet[3];
        logger.debug(`[Top Data] Pacote recebido: cmd=0x${commandByte?.toString(16)} [${packet.toString('hex')}]`);

        switch (commandByte) {
            case TD_EVENTS.CARD_READ: {
                // Extrair número do cartão do payload
                const cardData = packet.subarray(4, packet.length - 1);
                const cardNumber = cardData.toString('ascii').replace(/\0/g, '').trim();

                if (cardNumber && this.credentialCallback) {
                    const event: CredentialEvent = {
                        type: 'CARD',
                        rawValue: cardNumber,
                        timestamp: new Date(),
                    };
                    logger.debug(`[Top Data] Cartão lido: ${cardNumber}`);
                    this.credentialCallback(event);
                }
                break;
            }

            case TD_EVENTS.BIOMETRIC_READ: {
                // Extrair ID biométrico do payload
                const bioData = packet.subarray(4, packet.length - 1);
                const bioId = bioData.toString('ascii').replace(/\0/g, '').trim();

                if (bioId && this.credentialCallback) {
                    const event: CredentialEvent = {
                        type: 'BIOMETRIC',
                        rawValue: bioId,
                        timestamp: new Date(),
                    };
                    logger.debug(`[Top Data] Biometria lida: ${bioId}`);
                    this.credentialCallback(event);
                }
                break;
            }

            case TD_EVENTS.TURNSTILE_TURN:
                logger.debug(`[Top Data] Giro de catraca detectado`);
                break;

            default:
                logger.debug(`[Top Data] Pacote não tratado: cmd=0x${commandByte?.toString(16)}`);
        }
    }

    // ==========================================
    // CONTROLE DE ACESSO
    // ==========================================

    async grantAccess(direction: 'IN' | 'OUT'): Promise<void> {
        const command = direction === 'IN' ? TD_COMMANDS.GRANT_CLOCKWISE : TD_COMMANDS.GRANT_ANTICLOCKWISE;
        logger.debug(`[Top Data] Liberando catraca: ${direction}`);
        this.sendCommand(command);
    }

    async denyAccess(): Promise<void> {
        logger.debug(`[Top Data] Acesso negado — buzzer/LED`);
        this.sendCommand(TD_COMMANDS.DENY);
    }

    // ==========================================
    // EVENTOS DE CREDENCIAL
    // ==========================================

    onCredentialRead(callback: CredentialCallback): void {
        this.credentialCallback = callback;
        logger.debug(`[Top Data] Callback de credencial registrado — escutando eventos TCP`);
    }

    // ==========================================
    // STATUS
    // ==========================================

    async getStatus(): Promise<'CONNECTED' | 'DISCONNECTED' | 'ERROR'> {
        if (!this.connected || !this.socket) {
            return 'DISCONNECTED';
        }

        try {
            this.sendCommand(TD_COMMANDS.PING);
            return 'CONNECTED';
        } catch {
            return 'ERROR';
        }
    }
}
