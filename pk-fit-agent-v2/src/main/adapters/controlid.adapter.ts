import type { TurnstileAdapter, CredentialCallback, CredentialEvent } from './adapter.interface'
import { logger } from '../core/logger'

export interface ControlIdConfig {
  ip: string
  port: number
  authUser: string
  authPassword: string
}

export class ControlIdAdapter implements TurnstileAdapter {
  readonly brandName = 'Control ID'

  private ip: string
  private port: number
  private authUser: string
  private authPassword: string
  private connected: boolean = false
  private credentialCallback: CredentialCallback | null = null
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private lastEventId: number = 0

  constructor(config: ControlIdConfig) {
    this.ip = config.ip
    this.port = config.port
    this.authUser = config.authUser
    this.authPassword = config.authPassword
  }

  private get baseUrl(): string {
    return `http://${this.ip}:${this.port}`
  }

  private get authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (this.authUser && this.authPassword) {
      const credentials = Buffer.from(`${this.authUser}:${this.authPassword}`).toString('base64')
      headers['Authorization'] = `Basic ${credentials}`
    }
    return headers
  }

  private async request(endpoint: string, body?: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`
    const options: RequestInit = {
      method: body ? 'POST' : 'GET',
      headers: this.authHeaders,
      signal: AbortSignal.timeout(5000)
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return response.json()
    }
    return response.text()
  }

  async connect(): Promise<void> {
    logger.info(`[Control ID] Connecting to turnstile at ${this.ip}:${this.port}...`)

    try {
      await this.request('/get_catra_info.fcgi')
      this.connected = true
      logger.info(`[Control ID] ✅ Connected successfully!`)

      this.startEventPolling()
    } catch (error) {
      this.connected = false
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`[Control ID] ❌ Connection failed: ${msg}`)
      throw new Error(`Could not connect to Control ID turnstile: ${msg}`)
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
    this.connected = false
    logger.info(`[Control ID] Disconnected`)
  }

  isConnected(): boolean {
    return this.connected
  }

  async grantAccess(direction: 'IN' | 'OUT'): Promise<void> {
    const allow = direction === 'IN' ? 'clockwise' : 'anticlockwise'

    logger.debug(`[Control ID] Granting access: ${allow}`)

    try {
      await this.request('/execute_actions.fcgi', {
        actions: [
          {
            action: 'catra',
            parameters: { allow }
          }
        ]
      })

      logger.debug(`[Control ID] Access granted (${direction})`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`[Control ID] Error granting access: ${msg}`)
      throw error
    }
  }

  async denyAccess(): Promise<void> {
    logger.debug(`[Control ID] Access denied`)

    try {
      await this.request('/execute_actions.fcgi', {
        actions: [
          {
            action: 'catra',
            parameters: { allow: 'none' }
          }
        ]
      })
    } catch (error) {
      logger.debug(`[Control ID] Error signaling denial (not critical): ${error}`)
    }
  }

  onCredentialRead(callback: CredentialCallback): void {
    this.credentialCallback = callback
  }

  private startEventPolling(): void {
    if (this.pollingInterval) return

    logger.debug(`[Control ID] Starting event polling (500ms)`)

    this.pollingInterval = setInterval(async () => {
      if (!this.connected || !this.credentialCallback) return

      try {
        const result = (await this.request('/load_objects.fcgi', {
          object: 'access_logs',
          limit: 1,
          order: 'desc'
        })) as {
          access_logs?: Array<{ id: number; event?: number; card_id?: string; user_id?: number }>
        }

        const logs = result?.access_logs
        if (!logs || logs.length === 0) return

        const latest = logs[0]
        if (latest.id <= this.lastEventId) return

        this.lastEventId = latest.id

        let type: CredentialEvent['type'] = 'CARD'
        const event = latest.event
        if (event === 7 || event === 8) type = 'BIOMETRIC'
        if (event === 13) type = 'FACIAL'
        if (event === 10) type = 'QR_CODE'

        const credential: CredentialEvent = {
          type,
          rawValue: String(latest.card_id || latest.user_id || latest.id),
          timestamp: new Date()
        }

        logger.debug(`[Control ID] Credential read: ${type} — ${credential.rawValue}`)
        this.credentialCallback(credential)
      } catch (error) {
        if (this.connected) {
          logger.debug(`[Control ID] Polling error: ${error}`)
        }
      }
    }, 500)
  }

  async syncUserFace(providerUserId: string, name: string, faceImageBuffer: Buffer): Promise<void> {
    logger.info(`[Control ID] Syncing user: ${name} (Provider ID: ${providerUserId})`)

    try {
      const numericId = parseInt(providerUserId, 10)
      if (isNaN(numericId)) {
        throw new Error(`Invalid provider user ID: ${providerUserId}`)
      }

      await this.request('/create_objects.fcgi', {
        object: 'users',
        values: [
          {
            id: numericId,
            name: name,
            registration: String(numericId)
          }
        ]
      })

      if (faceImageBuffer && faceImageBuffer.length > 0) {
        logger.debug(`[Control ID] Sending face for ID ${numericId}...`)
        const base64Image = faceImageBuffer.toString('base64')

        await this.request('/set_user_face.fcgi', {
          user_id: numericId,
          face_image: base64Image
        })
      }

      logger.info(`[Control ID] ✅ User ${name} synced successfully.`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`[Control ID] ❌ Error syncing user ${name}: ${msg}`)
      throw error
    }
  }

  async removeUser(providerUserId: string): Promise<void> {
    const numericId = parseInt(providerUserId, 10)
    if (isNaN(numericId)) {
      logger.warn(`[Control ID] Invalid provider user ID for removal: ${providerUserId}`)
      return
    }

    logger.info(`[Control ID] Removing user ID: ${numericId}`)

    try {
      await this.request('/destroy_objects.fcgi', {
        object: 'users',
        where: {
          users: { id: numericId }
        }
      })
      logger.info(`[Control ID] ✅ User removed from hardware.`)
    } catch (error) {
      logger.error(`[Control ID] ❌ Error removing user: ${error}`)
    }
  }

  async getStatus(): Promise<'CONNECTED' | 'DISCONNECTED' | 'ERROR'> {
    try {
      await this.request('/get_catra_info.fcgi')
      this.connected = true
      return 'CONNECTED'
    } catch {
      this.connected = false
      return 'DISCONNECTED'
    }
  }

  async getTurnCount(): Promise<{ in: number; out: number; total: number }> {
    try {
      const result = (await this.request('/get_catra_info.fcgi')) as {
        clockwise?: number
        anticlockwise?: number
        total?: number
      }

      return {
        in: result?.clockwise || 0,
        out: result?.anticlockwise || 0,
        total: result?.total || 0
      }
    } catch {
      return { in: 0, out: 0, total: 0 }
    }
  }
}