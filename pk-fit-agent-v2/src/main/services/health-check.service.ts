import { logger } from '../core/logger'
import { supabase, getSupabase } from '../supabase/client'
import { circuitBreakerService } from '../services/circuit-breaker.service'
import { sqliteQueueService } from '../services/sqlite-queue.service'
import type { HealthCheckResult } from '../types/biometric.types'

export class HealthCheckService {
  async performFullCheck(): Promise<HealthCheckResult> {
    const errors: string[] = []

    const [
      supabaseCheck,
      storageCheck,
      controlIdCheck,
      queueCheck,
      realtimeCheck,
      circuitBreakerCheck
    ] = await Promise.all([
      this.checkSupabase(),
      this.checkStorage(),
      this.checkControlId(),
      this.checkQueue(),
      this.checkRealtime(),
      this.checkCircuitBreaker()
    ])

    if (!supabaseCheck) {
      errors.push('Supabase connection failed')
    }

    if (!storageCheck) {
      errors.push('Storage access failed')
    }

    if (!controlIdCheck) {
      errors.push('Control ID not reachable')
    }

    if (!queueCheck) {
      errors.push('Queue system not operational')
    }

    if (!realtimeCheck) {
      errors.push('Realtime subscription failed')
    }

    if (!circuitBreakerCheck) {
      errors.push('Circuit breaker in OPEN state')
    }

    const overall =
      supabaseCheck && storageCheck && controlIdCheck && queueCheck && circuitBreakerCheck

    logger.info('Health check completed', {
      overall,
      supabase: supabaseCheck,
      storage: storageCheck,
      controlId: controlIdCheck,
      queue: queueCheck,
      realtime: realtimeCheck,
      circuitBreaker: circuitBreakerCheck,
      errorCount: errors.length
    })

    return {
      overall,
      supabase: supabaseCheck,
      storage: storageCheck,
      controlId: controlIdCheck,
      queue: queueCheck,
      realtime: realtimeCheck,
      circuitBreaker: circuitBreakerCheck,
      errors
    }
  }

  private async checkSupabase(): Promise<boolean> {
    try {
      const { error } = await supabase.from('agent_heartbeats').select('id').limit(1)

      if (error) {
        logger.warn('Supabase health check failed', { error: error.message })
        return false
      }

      return true
    } catch (error) {
      logger.warn('Supabase health check exception', { error })
      return false
    }
  }

  private async checkStorage(): Promise<boolean> {
    try {
      const { data, error } = await getSupabase().storage.listBuckets()

      if (error) {
        logger.warn('Storage health check failed', { error: error.message })
        return false
      }

      const avatarsBucket = data?.find((b) => b.name === 'avatars')

      if (!avatarsBucket) {
        logger.warn('Avatars bucket not found')
        return false
      }

      return true
    } catch (error) {
      logger.warn('Storage health check exception', { error })
      return false
    }
  }

  private async checkControlId(): Promise<boolean> {
    try {
      const isAvailable = await circuitBreakerService.isAvailable('CONTROL_ID')

      if (!isAvailable) {
        logger.warn('Circuit breaker is OPEN for Control ID')
        return false
      }

      return true
    } catch (error) {
      logger.warn('Control ID health check exception', { error })
      return true
    }
  }

  private async checkQueue(): Promise<boolean> {
    try {
      sqliteQueueService.getStats()
      return true
    } catch (error) {
      logger.warn('Queue health check failed', { error })
      return false
    }
  }

  private async checkRealtime(): Promise<boolean> {
    try {
      const channel = supabase.channel('health-check')

      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Realtime health check passed')
        } else if (err) {
          logger.warn('Realtime health check status error', { error: err.message })
        }
      })

      setTimeout(() => {
        supabase.removeChannel(channel)
      }, 5000)

      return true
    } catch (error) {
      logger.warn('Realtime health check exception', { error })
      return false
    }
  }

  private async checkCircuitBreaker(): Promise<boolean> {
    try {
      const state = await circuitBreakerService.getState('CONTROL_ID')

      if (state === 'OPEN') {
        return false
      }

      return true
    } catch {
      return true
    }
  }

  async performQuickCheck(): Promise<boolean> {
    try {
      const { error } = await supabase.from('agent_heartbeats').select('id').limit(1)
      return !error
    } catch {
      return false
    }
  }
}

export const healthCheckService = new HealthCheckService()
