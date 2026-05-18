import { logger } from '../core/logger'
import { supabase } from '../supabase/client'
import type { SyncLogStatus } from '../types/biometric.types'

export interface AuditLogEntry {
  userId: string
  academyId: string
  provider: string
  providerUserId?: string
  status: SyncLogStatus
  message?: string
  durationMs?: number
  rawResponse?: string
}

export class AuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await supabase.rpc('log_face_sync', {
        p_user_id: entry.userId,
        p_academy_id: entry.academyId,
        p_provider: entry.provider,
        p_provider_user_id: entry.providerUserId || null,
        p_status: entry.status,
        p_message: entry.message || null,
        p_duration_ms: entry.durationMs || null,
        p_raw_response: entry.rawResponse || null
      })

      logger.debug('Audit log saved', entry)
    } catch (error) {
      logger.error('Failed to save audit log to database', { error, entry })
    }
  }

  async logSyncStart(
    userId: string,
    academyId: string,
    provider: string,
    providerUserId: string
  ): Promise<void> {
    await this.log({
      userId,
      academyId,
      provider,
      providerUserId,
      status: 'PROCESSING',
      message: 'Iniciando sincronização facial'
    })
  }

  async logSyncSuccess(
    userId: string,
    academyId: string,
    provider: string,
    providerUserId: string,
    durationMs: number
  ): Promise<void> {
    await this.log({
      userId,
      academyId,
      provider,
      providerUserId,
      status: 'SUCCESS',
      message: 'Sincronização facial concluída com sucesso',
      durationMs
    })

    logger.info('Face sync completed', { userId, providerUserId, durationMs })
  }

  async logSyncFailure(
    userId: string,
    academyId: string,
    provider: string,
    providerUserId: string | null,
    error: string,
    durationMs?: number,
    rawResponse?: string
  ): Promise<void> {
    await this.log({
      userId,
      academyId,
      provider,
      providerUserId: providerUserId || undefined,
      status: 'FAILED',
      message: error,
      durationMs,
      rawResponse
    })

    logger.error('Face sync failed', { userId, providerUserId, error, durationMs })
  }

  async getRecentLogs(
    academyId: string,
    limit: number = 50
  ): Promise<
    Array<{
      id: string
      userId: string
      provider: string
      status: string
      message: string | null
      durationMs: number | null
      createdAt: Date
    }>
  > {
    try {
      const { data, error } = await supabase
        .from('face_sync_logs')
        .select('id, user_id, provider, status, message, duration_ms, created_at')
        .eq('academy_id', academyId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return (
        data?.map((row) => ({
          id: row.id,
          userId: row.user_id,
          provider: row.provider,
          status: row.status,
          message: row.message,
          durationMs: row.duration_ms,
          createdAt: new Date(row.created_at)
        })) || []
      )
    } catch (error) {
      logger.error('Failed to get recent logs', { error, academyId })
      return []
    }
  }

  async getLogsByUserId(
    userId: string,
    limit: number = 20
  ): Promise<
    Array<{
      id: string
      status: string
      message: string | null
      durationMs: number | null
      createdAt: Date
    }>
  > {
    try {
      const { data, error } = await supabase
        .from('face_sync_logs')
        .select('id, status, message, duration_ms, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return (
        data?.map((row) => ({
          id: row.id,
          status: row.status,
          message: row.message,
          durationMs: row.duration_ms,
          createdAt: new Date(row.created_at)
        })) || []
      )
    } catch (error) {
      logger.error('Failed to get logs by user id', { error, userId })
      return []
    }
  }
}

export const auditService = new AuditService()
