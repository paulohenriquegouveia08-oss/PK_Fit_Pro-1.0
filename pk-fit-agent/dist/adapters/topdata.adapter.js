"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopDataAdapter = void 0;
const net = __importStar(require("net"));
const logger_1 = require("../core/logger");
// ==========================================
// TOP DATA ADAPTER — TCP Socket Communication
// Comunicação via TCP com equipamentos Top Data
// (Inner Acesso, Revolution, etc.)
// ==========================================
// Comandos TCP conhecidos do protocolo Top Data (EasyInner)
const TD_COMMANDS = {
    // Handshake / status
    PING: Buffer.from([0x02, 0x00, 0x01, 0x01, 0x03]), // ENQ - verifica conexão
    GET_STATUS: Buffer.from([0x02, 0x00, 0x01, 0x05, 0x03]), // Status do equipamento
    // Controle de acesso
    GRANT_CLOCKWISE: Buffer.from([0x02, 0x00, 0x02, 0x03, 0x01, 0x03]), // Liberar sentido horário (entrada)
    GRANT_ANTICLOCKWISE: Buffer.from([0x02, 0x00, 0x02, 0x03, 0x02, 0x03]), // Liberar anti-horário (saída)
    DENY: Buffer.from([0x02, 0x00, 0x02, 0x03, 0x00, 0x03]), // Negar acesso (buzzer)
};
// Eventos recebidos do equipamento
const TD_EVENTS = {
    CARD_READ: 0x04, // Leitura de cartão
    BIOMETRIC_READ: 0x07, // Leitura biométrica
    TURNSTILE_TURN: 0x06, // Giro da catraca detectado
};
class TopDataAdapter {
    constructor(ip, port, _authUser, _authPassword) {
        this.brandName = 'Top Data';
        this.socket = null;
        this.connected = false;
        this.credentialCallback = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000; // 5 segundos entre reconexões
        this.dataBuffer = Buffer.alloc(0);
        this.ip = ip;
        this.port = port || 3570; // Porta padrão dos equipamentos Top Data
    }
    // ==========================================
    // CONEXÃO TCP
    // ==========================================
    async connect() {
        logger_1.logger.info(`[Top Data] Conectando via TCP em ${this.ip}:${this.port}...`);
        return new Promise((resolve, reject) => {
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
                logger_1.logger.info(`[Top Data] ✅ Conectado com sucesso!`);
                // Enviar ping inicial para confirmar comunicação
                this.sendCommand(TD_COMMANDS.PING);
                resolve();
            });
            this.socket.on('data', (data) => {
                this.handleIncomingData(data);
            });
            this.socket.on('error', (error) => {
                logger_1.logger.error(`[Top Data] ❌ Erro de conexão: ${error.message}`);
                if (!this.connected) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });
            this.socket.on('close', () => {
                const wasConnected = this.connected;
                this.connected = false;
                logger_1.logger.warn(`[Top Data] Conexão fechada`);
                if (wasConnected) {
                    this.scheduleReconnect();
                }
            });
        });
    }
    async disconnect() {
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
        logger_1.logger.info(`[Top Data] Desconectado`);
    }
    isConnected() {
        return this.connected;
    }
    // ==========================================
    // RECONEXÃO AUTOMÁTICA
    // ==========================================
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error(`[Top Data] ❌ Máximo de tentativas de reconexão atingido (${this.maxReconnectAttempts})`);
            return;
        }
        this.reconnectAttempts++;
        logger_1.logger.info(`[Top Data] Reconectando em ${this.reconnectDelay / 1000}s... (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connect();
                logger_1.logger.info(`[Top Data] ✅ Reconectado com sucesso!`);
            }
            catch (error) {
                logger_1.logger.error(`[Top Data] Falha na reconexão: ${error instanceof Error ? error.message : error}`);
            }
        }, this.reconnectDelay);
    }
    // ==========================================
    // ENVIO DE COMANDOS TCP
    // ==========================================
    sendCommand(command) {
        if (!this.socket || !this.connected) {
            logger_1.logger.warn(`[Top Data] Tentativa de enviar comando sem conexão`);
            return;
        }
        try {
            this.socket.write(command);
            logger_1.logger.debug(`[Top Data] Comando enviado: [${command.toString('hex')}]`);
        }
        catch (error) {
            logger_1.logger.error(`[Top Data] Erro ao enviar comando: ${error instanceof Error ? error.message : error}`);
        }
    }
    // ==========================================
    // PROCESSAMENTO DE DADOS RECEBIDOS
    // ==========================================
    handleIncomingData(data) {
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
    processPacket(packet) {
        if (packet.length < 4)
            return;
        const commandByte = packet[3];
        logger_1.logger.debug(`[Top Data] Pacote recebido: cmd=0x${commandByte?.toString(16)} [${packet.toString('hex')}]`);
        switch (commandByte) {
            case TD_EVENTS.CARD_READ: {
                // Extrair número do cartão do payload
                const cardData = packet.subarray(4, packet.length - 1);
                const cardNumber = cardData.toString('ascii').replace(/\0/g, '').trim();
                if (cardNumber && this.credentialCallback) {
                    const event = {
                        type: 'CARD',
                        rawValue: cardNumber,
                        timestamp: new Date(),
                    };
                    logger_1.logger.debug(`[Top Data] Cartão lido: ${cardNumber}`);
                    this.credentialCallback(event);
                }
                break;
            }
            case TD_EVENTS.BIOMETRIC_READ: {
                // Extrair ID biométrico do payload
                const bioData = packet.subarray(4, packet.length - 1);
                const bioId = bioData.toString('ascii').replace(/\0/g, '').trim();
                if (bioId && this.credentialCallback) {
                    const event = {
                        type: 'BIOMETRIC',
                        rawValue: bioId,
                        timestamp: new Date(),
                    };
                    logger_1.logger.debug(`[Top Data] Biometria lida: ${bioId}`);
                    this.credentialCallback(event);
                }
                break;
            }
            case TD_EVENTS.TURNSTILE_TURN:
                logger_1.logger.debug(`[Top Data] Giro de catraca detectado`);
                break;
            default:
                logger_1.logger.debug(`[Top Data] Pacote não tratado: cmd=0x${commandByte?.toString(16)}`);
        }
    }
    // ==========================================
    // CONTROLE DE ACESSO
    // ==========================================
    async grantAccess(direction) {
        const command = direction === 'IN' ? TD_COMMANDS.GRANT_CLOCKWISE : TD_COMMANDS.GRANT_ANTICLOCKWISE;
        logger_1.logger.debug(`[Top Data] Liberando catraca: ${direction}`);
        this.sendCommand(command);
    }
    async denyAccess() {
        logger_1.logger.debug(`[Top Data] Acesso negado — buzzer/LED`);
        this.sendCommand(TD_COMMANDS.DENY);
    }
    // ==========================================
    // EVENTOS DE CREDENCIAL
    // ==========================================
    onCredentialRead(callback) {
        this.credentialCallback = callback;
        logger_1.logger.debug(`[Top Data] Callback de credencial registrado — escutando eventos TCP`);
    }
    // ==========================================
    // STATUS
    // ==========================================
    async getStatus() {
        if (!this.connected || !this.socket) {
            return 'DISCONNECTED';
        }
        try {
            this.sendCommand(TD_COMMANDS.PING);
            return 'CONNECTED';
        }
        catch {
            return 'ERROR';
        }
    }
}
exports.TopDataAdapter = TopDataAdapter;
//# sourceMappingURL=topdata.adapter.js.map