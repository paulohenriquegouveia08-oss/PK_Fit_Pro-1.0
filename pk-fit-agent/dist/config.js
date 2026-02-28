"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configFromLocal = configFromLocal;
/**
 * Converte a config local (salva pelo setup wizard)
 * na AgentConfig usada por todos os módulos
 */
function configFromLocal(local) {
    return {
        supabaseUrl: local.supabaseUrl,
        supabaseServiceKey: local.supabaseServiceKey,
        academyId: local.academyId,
        academyName: local.academyName,
        turnstileConfigId: local.turnstileConfigId,
        brand: local.brand,
        ip: local.ipAddress,
        port: local.port,
        authUser: local.authUser,
        authPassword: local.authPassword,
        heartbeatInterval: 30000,
        logLevel: 'info',
    };
}
//# sourceMappingURL=config.js.map