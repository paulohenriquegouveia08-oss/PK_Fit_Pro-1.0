"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSupabase = initSupabase;
exports.getSupabase = getSupabase;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = require("../core/logger");
let supabase = null;
/**
 * Inicializa o Supabase client com a service key
 * (service key para bypass de RLS — o Agent precisa de acesso total)
 */
function initSupabase(config) {
    supabase = (0, supabase_js_1.createClient)(config.supabaseUrl, config.supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });
    logger_1.logger.info('Supabase client inicializado');
    return supabase;
}
/**
 * Retorna o client Supabase (já inicializado)
 */
function getSupabase() {
    if (!supabase) {
        throw new Error('Supabase client não inicializado. Chame initSupabase() primeiro.');
    }
    return supabase;
}
//# sourceMappingURL=client.js.map