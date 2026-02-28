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
exports.HenryAdapter = void 0;
const net = __importStar(require("net"));
const logger_1 = require("../core/logger");
// ==========================================
// HENRY ADAPTER — HTTP + TCP Communication
// O Henry possui um app web embarcado acessível
// via HTTP e também comunica via TCP (porta 3000)
// ==========================================
class HenryAdapter {
    constructor(ip, port, authUser, authPassword) {
        this.brandName = 'Henry';
        this.connected = false;
        this.credentialCallback = null;
        this.pollingInterval = null;
        this.tcpSocket = null;
        this.tcpConnected = false;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.tcpPort = 3000; // Porta TCP padrão Henry
        this.dataBuffer = Buffer.alloc(0);
        this.lastEventId = 0;
        this.ip = ip;
        this.port = port || 80;
        this.authUser = authUser || 'primmesf'; // Credenciais padrão Henry
        this.authPassword = authPassword || '121314';
    }
    // ==========================================
    // URL base e HTTP helpers
    // ==========================================
    get baseUrl() {
        return `http://${this.ip}:${this.port}`;
    }
    get authHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.authUser && this.authPassword) {
            const credentials = Buffer.from(`${this.authUser}:${this.authPassword}`).toString('base64');
            headers['Authorization'] = `Basic ${credentials}`;
        }
        return headers;
    }
    async httpRequest(endpoint, method = 'GET', body) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: this.authHeaders,
            signal: AbortSignal.timeout(5000),
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }
        return response.text();
    }
    // ==========================================
    // CONEXÃO (HTTP + TCP)
    // ==========================================
    async connect() {
        logger_1.logger.info(`[Henry] Conectando ao equipamento em ${this.ip}...`);
        // 1. Testar conexão HTTP com o app web embarcado
        try {
            await this.httpRequest('/api/system/status');
            logger_1.logger.info(`[Henry] ✅ Conexão HTTP estabelecida`);
        }
        catch (httpError) {
            // Tentar endpoint alternativo (varia por modelo/firmware)
            try {
                await this.httpRequest('/status');
                logger_1.logger.info(`[Henry] ✅ Conexão HTTP estabelecida (endpoint alternativo)`);
            }
            catch {
                logger_1.logger.warn(`[Henry] ⚠️ App web não respondeu — tentando apenas TCP`);
            }
        }
        // 2. Conectar via TCP para eventos em tempo real
        try {
            await this.connectTcp();
        }
        catch (tcpError) {
            logger_1.logger.warn(`[Henry] ⚠️ TCP não disponível: ${tcpError instanceof Error ? tcpError.message : tcpError}`);
            logger_1.logger.info(`[Henry] Usando apenas polling HTTP para eventos`);
        }
        this.connected = true;
        logger_1.logger.info(`[Henry] ✅ Conectado com sucesso!`);
    }
    connectTcp() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout TCP (5s)'));
            }, 5000);
            this.tcpSocket = net.createConnection({
                host: this.ip,
                port: this.tcpPort,
            });
            this.tcpSocket.on('connect', () => {
                clearTimeout(timeout);
                this.tcpConnected = true;
                this.reconnectAttempts = 0;
                logger_1.logger.info(`[Henry] ✅ Conexão TCP estabelecida na porta ${this.tcpPort}`);
                resolve();
            });
            this.tcpSocket.on('data', (data) => {
                this.handleTcpData(data);
            });
            this.tcpSocket.on('error', (error) => {
                if (!this.tcpConnected) {
                    clearTimeout(timeout);
                    reject(error);
                }
                else {
                    logger_1.logger.error(`[Henry] Erro TCP: ${error.message}`);
                }
            });
            this.tcpSocket.on('close', () => {
                const wasConnected = this.tcpConnected;
                this.tcpConnected = false;
                if (wasConnected && this.connected) {
                    logger_1.logger.warn(`[Henry] Conexão TCP perdida — reconectando...`);
                    this.scheduleTcpReconnect();
                }
            });
        });
    }
    scheduleTcpReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error(`[Henry] ❌ Máximo de reconexões TCP atingido — usando apenas HTTP`);
            this.startHttpPolling();
            return;
        }
        this.reconnectAttempts++;
        logger_1.logger.info(`[Henry] Reconectando TCP em ${this.reconnectDelay / 1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connectTcp();
            }
            catch {
                logger_1.logger.warn(`[Henry] Falha na reconexão TCP`);
            }
        }, this.reconnectDelay);
    }
    async disconnect() {
        // Parar polling HTTP
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        // Parar reconexão
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        // Fechar TCP
        if (this.tcpSocket) {
            this.tcpSocket.removeAllListeners();
            this.tcpSocket.destroy();
            this.tcpSocket = null;
            this.tcpConnected = false;
        }
        this.connected = false;
        logger_1.logger.info(`[Henry] Desconectado`);
    }
    isConnected() {
        return this.connected;
    }
    // ==========================================
    // PROCESSAMENTO DE DADOS TCP
    // ==========================================
    handleTcpData(data) {
        this.dataBuffer = Buffer.concat([this.dataBuffer, data]);
        // Protocolo Henry: pacotes delimitados
        while (this.dataBuffer.length >= 4) {
            // Tentar identificar um pacote completo
            const packetLength = this.dataBuffer[1] || 0;
            if (this.dataBuffer.length < packetLength + 2) {
                break; // Aguardar mais dados
            }
            const packet = this.dataBuffer.subarray(0, packetLength + 2);
            this.dataBuffer = this.dataBuffer.subarray(packetLength + 2);
            this.processTcpPacket(packet);
        }
    }
    processTcpPacket(packet) {
        logger_1.logger.debug(`[Henry] Pacote TCP: [${packet.toString('hex')}]`);
        if (packet.length < 3)
            return;
        const commandType = packet[2];
        // Detectar eventos de credencial
        // Os códigos dependem do modelo/firmware, mas seguem padrão similar
        switch (commandType) {
            case 0x01: // Cartão de proximidade
            case 0x02: { // Smart card
                const cardData = packet.subarray(3).toString('ascii').replace(/\0/g, '').trim();
                if (cardData && this.credentialCallback) {
                    this.credentialCallback({
                        type: 'CARD',
                        rawValue: cardData,
                        timestamp: new Date(),
                    });
                    logger_1.logger.debug(`[Henry] Cartão lido via TCP: ${cardData}`);
                }
                break;
            }
            case 0x03: { // Biometria
                const bioId = packet.subarray(3).toString('ascii').replace(/\0/g, '').trim();
                if (bioId && this.credentialCallback) {
                    this.credentialCallback({
                        type: 'BIOMETRIC',
                        rawValue: bioId,
                        timestamp: new Date(),
                    });
                    logger_1.logger.debug(`[Henry] Biometria lida via TCP: ${bioId}`);
                }
                break;
            }
            case 0x04: { // Reconhecimento facial
                const faceId = packet.subarray(3).toString('ascii').replace(/\0/g, '').trim();
                if (faceId && this.credentialCallback) {
                    this.credentialCallback({
                        type: 'FACIAL',
                        rawValue: faceId,
                        timestamp: new Date(),
                    });
                    logger_1.logger.debug(`[Henry] Facial lido via TCP: ${faceId}`);
                }
                break;
            }
            default:
                logger_1.logger.debug(`[Henry] Pacote TCP não tratado: type=0x${commandType?.toString(16)}`);
        }
    }
    // ==========================================
    // POLLING HTTP (fallback se TCP não disponível)
    // ==========================================
    startHttpPolling() {
        if (this.pollingInterval)
            return;
        logger_1.logger.info(`[Henry] Iniciando polling HTTP de eventos (1s)`);
        this.pollingInterval = setInterval(async () => {
            if (!this.connected || !this.credentialCallback)
                return;
            try {
                // Buscar eventos recentes via app web embarcado
                const result = await this.httpRequest('/api/access/events?limit=1&order=desc');
                const events = result?.events;
                if (!events || events.length === 0)
                    return;
                const latest = events[0];
                if (latest.id <= this.lastEventId)
                    return;
                this.lastEventId = latest.id;
                // Mapear tipo de credencial
                let type = 'CARD';
                if (latest.type === 'biometric' || latest.type === 'bio')
                    type = 'BIOMETRIC';
                if (latest.type === 'facial' || latest.type === 'face')
                    type = 'FACIAL';
                if (latest.type === 'qrcode' || latest.type === 'qr')
                    type = 'QR_CODE';
                const event = {
                    type,
                    rawValue: String(latest.credential || latest.user_id || latest.id),
                    timestamp: new Date(),
                };
                logger_1.logger.debug(`[Henry] Credencial via HTTP: ${type} — ${event.rawValue}`);
                this.credentialCallback(event);
            }
            catch (error) {
                if (this.connected) {
                    logger_1.logger.debug(`[Henry] Erro no polling HTTP: ${error}`);
                }
            }
        }, 1000);
    }
    // ==========================================
    // CONTROLE DE ACESSO (via HTTP)
    // ==========================================
    async grantAccess(direction) {
        logger_1.logger.debug(`[Henry] Liberando catraca: ${direction}`);
        try {
            // Tentar via HTTP primeiro (app web embarcado)
            await this.httpRequest('/api/access/grant', 'POST', {
                direction: direction === 'IN' ? 'clockwise' : 'anticlockwise',
            });
            logger_1.logger.debug(`[Henry] Catraca liberada via HTTP (${direction})`);
        }
        catch {
            // Fallback: tentar via TCP
            if (this.tcpConnected && this.tcpSocket) {
                const dirByte = direction === 'IN' ? 0x01 : 0x02;
                const command = Buffer.from([0x02, 0x03, 0x10, dirByte, 0x03]);
                this.tcpSocket.write(command);
                logger_1.logger.debug(`[Henry] Catraca liberada via TCP (${direction})`);
            }
            else {
                logger_1.logger.error(`[Henry] Falha ao liberar catraca — sem comunicação`);
            }
        }
    }
    async denyAccess() {
        logger_1.logger.debug(`[Henry] Acesso negado`);
        try {
            await this.httpRequest('/api/access/deny', 'POST', {});
        }
        catch {
            // Fallback: TCP
            if (this.tcpConnected && this.tcpSocket) {
                const command = Buffer.from([0x02, 0x03, 0x10, 0x00, 0x03]);
                this.tcpSocket.write(command);
                logger_1.logger.debug(`[Henry] Negação enviada via TCP`);
            }
            else {
                logger_1.logger.debug(`[Henry] Negação: sem comunicação ativa (não crítico)`);
            }
        }
    }
    // ==========================================
    // EVENTOS DE CREDENCIAL
    // ==========================================
    onCredentialRead(callback) {
        this.credentialCallback = callback;
        // Se TCP está conectado, os eventos já são recebidos automaticamente
        if (this.tcpConnected) {
            logger_1.logger.debug(`[Henry] Callback registrado — escutando eventos TCP`);
        }
        else {
            // Sem TCP, usar polling HTTP
            this.startHttpPolling();
            logger_1.logger.debug(`[Henry] Callback registrado — usando polling HTTP`);
        }
    }
    // ==========================================
    // STATUS
    // ==========================================
    async getStatus() {
        if (!this.connected)
            return 'DISCONNECTED';
        try {
            await this.httpRequest('/api/system/status');
            return 'CONNECTED';
        }
        catch {
            try {
                await this.httpRequest('/status');
                return 'CONNECTED';
            }
            catch {
                if (this.tcpConnected)
                    return 'CONNECTED';
                this.connected = false;
                return 'ERROR';
            }
        }
    }
}
exports.HenryAdapter = HenryAdapter;
//# sourceMappingURL=henry.adapter.js.map