import { logger } from '../core/logger'
import { supabase } from '../supabase/client'
import type { CircuitBreakerState, CircuitBreakerMode } from '../types/biometric.types'

export interface CircuitBreakerConfig {
  failureThreshold: number
  successThreshold: number
  timeout: number
}

const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000
}

export class CircuitBreakerService {
  private localState: Map<string, CircuitBreakerState> = new Map()
  private config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async recordSuccess(provider: string): Promise<void> {
    const state = this.getOrCreateLocalState(provider)

    if (state.state === 'HALF_OPEN') {
      if (state.failureCount >= this.config.successThreshold) {
        await this.setState(provider, 'CLOSED')
        logger.info('Circuit breaker CLOSED after successful recovery', { provider })
      } else {
        state.failureCount++
      }
    } else if (state.state === 'CLOSED') {
      state.failureCount = 0
    }

    state.lastSuccessAt = new Date()
    this.localState.set(provider, state)

    await this.syncToDatabase(provider, 'CLOSED', true)
  }

  async recordFailure(provider: string): Promise<void> {
    const state = this.getOrCreateLocalState(provider)
    state.failureCount++
    state.lastFailureAt = new Date()

    if (state.state === 'CLOSED' && state.failureCount >= this.config.failureThreshold) {
      await this.setState(provider, 'OPEN')
      logger.warn('Circuit breaker OPENED due to repeated failures', {
        provider,
        failureCount: state.failureCount
      })
    } else if (state.state === 'OPEN') {
      const timeSinceOpen = state.openedAt ? Date.now() - state.openedAt.getTime() : 0

      if (timeSinceOpen >= this.config.timeout) {
        await this.setState(provider, 'HALF_OPEN')
        logger.info('Circuit breaker HALF_OPEN after timeout', {
          provider,
          timeout: this.config.timeout
        })
      }
    } else if (state.state === 'HALF_OPEN') {
      await this.setState(provider, 'OPEN')
      state.openedAt = new Date()
      logger.warn('Circuit breaker re-OPENED after failure in HALF_OPEN state', { provider })
    }

    this.localState.set(provider, state)
    await this.syncToDatabase(provider, state.state, false)
  }

  async isAvailable(provider: string): Promise<boolean> {
    const state = this.getOrCreateLocalState(provider)

    if (state.state === 'CLOSED') {
      return true
    }

    if (state.state === 'OPEN') {
      const timeSinceOpen = state.openedAt ? Date.now() - state.openedAt.getTime() : 0

      if (timeSinceOpen >= this.config.timeout) {
        await this.setState(provider, 'HALF_OPEN')
        return true
      }

      return false
    }

    if (state.state === 'HALF_OPEN') {
      return true
    }

    return true
  }

  async getState(provider: string): Promise<CircuitBreakerMode> {
    const local = this.localState.get(provider)

    if (local) {
      return local.state
    }

    await this.loadFromDatabase(provider)
    const loaded = this.localState.get(provider)

    return loaded?.state || 'CLOSED'
  }

  private getOrCreateLocalState(provider: string): CircuitBreakerState {
    return (
      this.localState.get(provider) || {
        provider,
        state: 'CLOSED',
        failureCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        openedAt: null
      }
    )
  }

  private async setState(provider: string, state: CircuitBreakerMode): Promise<void> {
    const current = this.getOrCreateLocalState(provider)
    current.state = state

    if (state === 'OPEN' && !current.openedAt) {
      current.openedAt = new Date()
    }

    if (state === 'CLOSED') {
      current.failureCount = 0
      current.openedAt = null
    }

    this.localState.set(provider, current)
  }

  private async loadFromDatabase(provider: string): Promise<void> {
    try {
      const { data, error } = await supabase.rpc('get_circuit_breaker_state', {
        p_provider: provider
      })

      if (error || !data || data.length === 0) {
        return
      }

      const dbState = data[0]
      this.localState.set(provider, {
        provider,
        state: dbState.state,
        failureCount: dbState.failure_count,
        lastFailureAt: dbState.last_failure_at ? new Date(dbState.last_failure_at) : null,
        lastSuccessAt: dbState.last_success_at ? new Date(dbState.last_success_at) : null,
        openedAt: dbState.opened_at ? new Date(dbState.opened_at) : null
      })
    } catch (error) {
      logger.debug('Failed to load circuit breaker state from database', { error, provider })
    }
  }

  private async syncToDatabase(
    provider: string,
    state: CircuitBreakerMode,
    success: boolean
  ): Promise<void> {
    try {
      await supabase.rpc('update_circuit_breaker', {
        p_provider: provider,
        p_state: state,
        p_success: success
      })
    } catch (error) {
      logger.debug('Failed to sync circuit breaker state to database', { error, provider })
    }
  }

  reset(provider: string): void {
    this.localState.set(provider, {
      provider,
      state: 'CLOSED',
      failureCount: 0,
      lastFailureAt: null,
      lastSuccessAt: null,
      openedAt: null
    })

    logger.info('Circuit breaker reset', { provider })
  }

  getLocalState(provider: string): CircuitBreakerState | undefined {
    return this.localState.get(provider)
  }
}

export const circuitBreakerService = new CircuitBreakerService()
