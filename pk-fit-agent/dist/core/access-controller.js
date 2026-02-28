"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessController = void 0;
const client_1 = require("../supabase/client");
const logger_1 = require("./logger");
/**
 * Cache local de credenciais → user_id
 * Evita buscas repetidas no banco para o mesmo cartão/biometria
 */
const credentialCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
class AccessController {
    constructor(adapter, config) {
        this.processing = false;
        this.adapter = adapter;
        this.config = config;
    }
    /**
     * Inicia o controller — registra o callback de credencial no adapter
     */
    start() {
        logger_1.logger.info('AccessController iniciado — aguardando leituras de credencial...');
        this.adapter.onCredentialRead(async (event) => {
            await this.handleCredentialEvent(event);
        });
    }
    /**
     * Handler principal — chamado quando alguém encosta cartão/biometria
     * PERFORMANCE CRÍTICA: cada ms conta aqui
     */
    async handleCredentialEvent(event) {
        // Evitar processar dois eventos simultâneos
        if (this.processing) {
            logger_1.logger.debug('Evento ignorado — processamento em andamento');
            return;
        }
        this.processing = true;
        const startTime = Date.now();
        try {
            logger_1.logger.debug(`Credencial recebida: ${event.type} — ${event.rawValue}`);
            // 1. Resolver credencial → user_id
            const userId = await this.resolveUserId(event);
            if (!userId) {
                // Credencial não mapeada a nenhum aluno
                logger_1.logger.access(false, 'Desconhecido', 'Credencial não encontrada');
                await this.adapter.denyAccess();
                await this.logAccessAsync(null, event, false, 'NAO_ENCONTRADO', 'Desconhecido');
                return;
            }
            // 2. Validar acesso via RPC (RÁPIDO — 1 query SQL)
            const result = await this.validateAccess(userId);
            const elapsed = Date.now() - startTime;
            const userName = result.user_name || 'Aluno';
            // 3. Liberar ou bloquear
            if (result.granted) {
                logger_1.logger.access(true, userName, `${result.plan_name || 'Plano'} (${elapsed}ms)`);
                await this.adapter.grantAccess('IN');
            }
            else {
                logger_1.logger.access(false, userName, `${result.message} (${elapsed}ms)`);
                await this.adapter.denyAccess();
            }
            // 4. Log assíncrono — NÃO bloqueia o fluxo
            this.logAccessAsync(userId, event, result.granted, result.granted ? undefined : result.reason, userName).catch(err => logger_1.logger.debug(`Erro no log assíncrono: ${err}`));
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger_1.logger.error(`Erro no processamento de acesso: ${msg}`);
            // Em caso de erro, nega acesso por segurança
            try {
                await this.adapter.denyAccess();
            }
            catch {
                // ignore
            }
        }
        finally {
            this.processing = false;
        }
    }
    /**
     * Resolve credencial bruta → user_id
     * Usa cache local para evitar buscas no banco
     */
    async resolveUserId(event) {
        const cacheKey = `${event.type}:${event.rawValue}`;
        // Verificar cache
        const cached = credentialCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            logger_1.logger.debug(`[Cache HIT] ${cached.userName}`);
            return cached.userId;
        }
        // Buscar no Supabase
        // A credencial raw_value pode ser o user_id direto (Control ID)
        // ou precisar de mapeamento (cartão/biometria)
        const supabase = (0, client_1.getSupabase)();
        // Tentar como user_id direto
        const { data: user } = await supabase
            .from('users')
            .select('id, name')
            .eq('id', event.rawValue)
            .single();
        if (user) {
            credentialCache.set(cacheKey, {
                userId: user.id,
                userName: user.name,
                expiresAt: Date.now() + CACHE_TTL_MS,
            });
            return user.id;
        }
        // Se não encontrou como UUID, pode ser identificador numérico
        // Aqui caberia uma tabela de mapeamento credential → user
        logger_1.logger.debug(`Credencial ${event.rawValue} não mapeada a nenhum usuário`);
        return null;
    }
    /**
     * Chama a RPC validate_student_access no Supabase
     * RÁPIDO: executa em uma única query SQL
     */
    async validateAccess(userId) {
        const supabase = (0, client_1.getSupabase)();
        const { data, error } = await supabase.rpc('validate_student_access', {
            p_academy_id: this.config.academyId,
            p_user_id: userId,
        });
        if (error) {
            logger_1.logger.error(`Erro na RPC validate_student_access: ${error.message}`);
            return {
                granted: false,
                reason: 'ERRO_SISTEMA',
                message: 'Erro na validação — tente novamente',
            };
        }
        return data;
    }
    /**
     * Registra log de acesso no Supabase (assíncrono)
     * Não bloqueia a liberação da catraca
     */
    async logAccessAsync(userId, event, granted, denialReason, userName) {
        const supabase = (0, client_1.getSupabase)();
        await supabase.from('access_logs').insert({
            academy_id: this.config.academyId,
            user_id: userId,
            turnstile_config_id: this.config.turnstileConfigId,
            direction: 'IN',
            access_granted: granted,
            denial_reason: denialReason || null,
            identification_method: event.type,
            raw_credential: event.rawValue,
            user_name: userName || null,
        });
    }
}
exports.AccessController = AccessController;
//# sourceMappingURL=access-controller.js.map