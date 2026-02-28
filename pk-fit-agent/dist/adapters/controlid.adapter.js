"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlIdAdapter = void 0;
const logger_1 = require("../core/logger");
// ==========================================
// CONTROL ID ADAPTER — REST API
// Comunicação via HTTP com endpoints .fcgi
// ==========================================
class ControlIdAdapter {
    constructor(ip, port, authUser, authPassword) {
        this.brandName = 'Control ID';
        this.connected = false;
        this.credentialCallback = null;
        this.pollingInterval = null;
        this.lastEventId = 0;
        this.ip = ip;
        this.port = port;
        this.authUser = authUser;
        this.authPassword = authPassword;
    }
    // ==========================================
    // URL base
    // ==========================================
    get baseUrl() {
        return `http://${this.ip}:${this.port}`;
    }
    // ==========================================
    // HTTP helpers
    // ==========================================
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
    async request(endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method: body ? 'POST' : 'GET',
            headers: this.authHeaders,
            signal: AbortSignal.timeout(5000), // timeout de 5s
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
    // CONEXÃO
    // ==========================================
    async connect() {
        logger_1.logger.info(`[Control ID] Conectando à catraca em ${this.ip}:${this.port}...`);
        try {
            // Testa conexão buscando info da catraca
            await this.request('/get_catra_info.fcgi');
            this.connected = true;
            logger_1.logger.info(`[Control ID] ✅ Conectado com sucesso!`);
            // Inicia polling de eventos de credencial
            this.startEventPolling();
        }
        catch (error) {
            this.connected = false;
            const msg = error instanceof Error ? error.message : String(error);
            logger_1.logger.error(`[Control ID] ❌ Falha na conexão: ${msg}`);
            throw new Error(`Não foi possível conectar à catraca Control ID: ${msg}`);
        }
    }
    async disconnect() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.connected = false;
        logger_1.logger.info(`[Control ID] Desconectado`);
    }
    isConnected() {
        return this.connected;
    }
    // ==========================================
    // CONTROLE DE ACESSO
    // ==========================================
    async grantAccess(direction) {
        // clockwise = sentido horário (entrada), anticlockwise = anti-horário (saída)
        const allow = direction === 'IN' ? 'clockwise' : 'anticlockwise';
        logger_1.logger.debug(`[Control ID] Liberando catraca: ${allow}`);
        try {
            await this.request('/execute_actions.fcgi', {
                actions: [
                    {
                        action: 'catra',
                        parameters: { allow },
                    },
                ],
            });
            logger_1.logger.debug(`[Control ID] Catraca liberada (${direction})`);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger_1.logger.error(`[Control ID] Erro ao liberar: ${msg}`);
            throw error;
        }
    }
    async denyAccess() {
        logger_1.logger.debug(`[Control ID] Acesso negado — catraca travada`);
        try {
            // Aciona buzzer/LED vermelho se disponível
            await this.request('/execute_actions.fcgi', {
                actions: [
                    {
                        action: 'catra',
                        parameters: { allow: 'none' },
                    },
                ],
            });
        }
        catch (error) {
            // Deny é "não fazer nada" na catraca, então falha silenciosa é ok
            logger_1.logger.debug(`[Control ID] Erro ao sinalizar negação (não crítico): ${error}`);
        }
    }
    // ==========================================
    // EVENTOS DE CREDENCIAL
    // ==========================================
    onCredentialRead(callback) {
        this.credentialCallback = callback;
    }
    /**
     * Polling de eventos de acesso.
     * A Control ID notifica eventos via load_objects.
     * Poll a cada 500ms para resposta rápida.
     */
    startEventPolling() {
        if (this.pollingInterval)
            return;
        logger_1.logger.debug(`[Control ID] Iniciando polling de eventos (500ms)`);
        this.pollingInterval = setInterval(async () => {
            if (!this.connected || !this.credentialCallback)
                return;
            try {
                const result = await this.request('/load_objects.fcgi', {
                    object: 'access_logs',
                    limit: 1,
                    order: 'desc',
                });
                const logs = result?.access_logs;
                if (!logs || logs.length === 0)
                    return;
                const latest = logs[0];
                if (latest.id <= this.lastEventId)
                    return; // já processado
                this.lastEventId = latest.id;
                // Determinar tipo de credencial
                let type = 'CARD';
                const event = latest.event;
                if (event === 7 || event === 8)
                    type = 'BIOMETRIC';
                if (event === 13)
                    type = 'FACIAL';
                if (event === 10)
                    type = 'QR_CODE';
                const credential = {
                    type,
                    rawValue: String(latest.card_id || latest.user_id || latest.id),
                    timestamp: new Date(),
                };
                logger_1.logger.debug(`[Control ID] Credencial lida: ${type} — ${credential.rawValue}`);
                this.credentialCallback(credential);
            }
            catch (error) {
                // Polling silencioso — erros podem ser transientes
                if (this.connected) {
                    logger_1.logger.debug(`[Control ID] Erro no polling: ${error}`);
                }
            }
        }, 500); // 500ms = resposta em no máximo meio segundo
    }
    // ==========================================
    // INFO
    // ==========================================
    async getStatus() {
        try {
            await this.request('/get_catra_info.fcgi');
            this.connected = true;
            return 'CONNECTED';
        }
        catch {
            this.connected = false;
            return 'DISCONNECTED';
        }
    }
    async getTurnCount() {
        try {
            const result = await this.request('/get_catra_info.fcgi');
            return {
                in: result?.clockwise || 0,
                out: result?.anticlockwise || 0,
                total: result?.total || 0,
            };
        }
        catch {
            return { in: 0, out: 0, total: 0 };
        }
    }
}
exports.ControlIdAdapter = ControlIdAdapter;
//# sourceMappingURL=controlid.adapter.js.map