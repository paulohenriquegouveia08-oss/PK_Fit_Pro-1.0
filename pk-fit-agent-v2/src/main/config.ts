import type { LocalConfig } from './core/setup'

// ==========================================
// TIPOS
// ==========================================

export type TurnstileBrand = 'CONTROL_ID' | 'TOP_DATA' | 'HENRY'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface AgentConfig {
  // Supabase
  supabaseUrl: string
  supabaseServiceKey: string

  // Academia
  academyId: string
  academyName: string
  turnstileConfigId: string

  // Catraca
  brand: TurnstileBrand
  ip: string
  port: number
  authUser: string
  authPassword: string

  // Agent
  heartbeatInterval: number
  logLevel: LogLevel
}

/**
 * Converte a config local (salva pelo setup wizard)
 * na AgentConfig usada por todos os módulos
 */
export function configFromLocal(local: LocalConfig): AgentConfig {
  return {
    supabaseUrl: local.supabaseUrl,
    supabaseServiceKey: local.supabaseServiceKey,
    academyId: local.academyId,
    academyName: local.academyName,
    turnstileConfigId: local.turnstileConfigId,
    brand: local.brand as TurnstileBrand,
    ip: local.ipAddress,
    port: local.port,
    authUser: local.authUser,
    authPassword: local.authPassword,
    heartbeatInterval: 30000,
    logLevel: 'info'
  }
}
