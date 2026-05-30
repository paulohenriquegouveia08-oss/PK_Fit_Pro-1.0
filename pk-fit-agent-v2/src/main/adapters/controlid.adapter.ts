import type { TurnstileAdapter, CredentialCallback, CredentialEvent } from './adapter.interface'
import { logger } from '../core/logger'

export interface ControlIdConfig {
  ip: string
  port: number
  authUser: string
  authPassword: string
}

// ==========================================
// ADAPTER CONTROL ID
// Implementado conforme documentação oficial:
// https://www.controlid.com.br/docs/access-api-pt/
// https://documenter.getpostman.com/view/10800185/2s9YJgSKm2
// https://github.com/controlid/integracao
// ==========================================

export class ControlIdAdapter implements TurnstileAdapter {
  readonly brandName = 'Control ID'

  private ip: string
  private port: number
  private authUser: string
  private authPassword: string
  private connected: boolean = false
  private session: string | null = null
  private sessionRefreshInterval: ReturnType<typeof setInterval> | null = null
  private credentialCallback: CredentialCallback | null = null
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private lastEventId: number = 0

  // Intervalo de renovação da sessão (10 minutos)
  private static readonly SESSION_REFRESH_MS = 10 * 60 * 1000
  // Intervalo de polling de eventos (2 segundos — seguro para o hardware)
  private static readonly POLLING_INTERVAL_MS = 2000
  // Timeout para requisições HTTP
  private static readonly REQUEST_TIMEOUT_MS = 5000

  constructor(config: ControlIdConfig) {
    this.ip = config.ip
    this.port = config.port
    this.authUser = config.authUser
    this.authPassword = config.authPassword
  }

  private get baseUrl(): string {
    return `http://${this.ip}:${this.port}`
  }

  // ==========================================
  // AUTENTICAÇÃO — /login.fcgi
  // Conforme: https://www.controlid.com.br/docs/access-api-pt/primeiros-passos/realizar-login/
  // ==========================================

  /**
   * Realiza login na Control iD e obtém session token.
   * O token deve ser passado em todas as chamadas subsequentes
   * via query string: ?session=TOKEN
   */
  private async login(): Promise<string> {
    const url = `${this.baseUrl}/login.fcgi`
    logger.debug(`[Control ID] Logging in at ${this.ip}:${this.port}...`)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: this.authUser,
        password: this.authPassword
      }),
      signal: AbortSignal.timeout(ControlIdAdapter.REQUEST_TIMEOUT_MS)
    })

    if (!response.ok) {
      throw new Error(`Login failed: HTTP ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as { session?: string }

    if (!data.session) {
      throw new Error('Login failed: no session token in response')
    }

    this.session = data.session
    logger.debug(`[Control ID] Login successful — session acquired`)
    return data.session
  }

  /**
   * Garante que existe uma sessão válida.
   * Se não houver, faz login automaticamente.
   */
  private async ensureSession(): Promise<string> {
    if (!this.session) {
      return await this.login()
    }
    return this.session
  }

  /**
   * Inicia a renovação periódica da sessão.
   * A Control iD expira sessões após um período de inatividade.
   */
  private startSessionRefresh(): void {
    if (this.sessionRefreshInterval) return

    this.sessionRefreshInterval = setInterval(async () => {
      try {
        await this.login()
        logger.debug('[Control ID] Session refreshed')
      } catch (error) {
        logger.warn(`[Control ID] Session refresh failed: ${error}`)
        this.session = null
      }
    }, ControlIdAdapter.SESSION_REFRESH_MS)
  }

  private stopSessionRefresh(): void {
    if (this.sessionRefreshInterval) {
      clearInterval(this.sessionRefreshInterval)
      this.sessionRefreshInterval = null
    }
  }

  // ==========================================
  // REQUISIÇÃO GENÉRICA — com session token
  // ==========================================

  /**
   * Executa uma requisição POST autenticada para a Control iD.
   * A session é passada via query string conforme documentação oficial.
   */
  private async request(endpoint: string, body?: unknown): Promise<unknown> {
    const session = await this.ensureSession()
    const separator = endpoint.includes('?') ? '&' : '?'
    const url = `${this.baseUrl}${endpoint}${separator}session=${session}`

    const options: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(ControlIdAdapter.REQUEST_TIMEOUT_MS)
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    // Se receber 401, tenta re-login e repete a chamada uma vez
    if (response.status === 401) {
      logger.warn('[Control ID] Session expired — re-authenticating...')
      this.session = null
      const newSession = await this.login()
      const retryUrl = `${this.baseUrl}${endpoint}${separator}session=${newSession}`
      const retryResponse = await fetch(retryUrl, options)

      if (!retryResponse.ok) {
        throw new Error(`HTTP ${retryResponse.status}: ${retryResponse.statusText}`)
      }

      const retryContentType = retryResponse.headers.get('content-type') || ''
      if (retryContentType.includes('application/json')) {
        return retryResponse.json()
      }
      return retryResponse.text()
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return response.json()
    }
    return response.text()
  }

  // ==========================================
  // CONEXÃO
  // ==========================================

  async connect(): Promise<void> {
    logger.info(`[Control ID] Connecting to turnstile at ${this.ip}:${this.port}...`)

    try {
      // 1. Primeiro, faz login para obter session token
      await this.login()

      // 2. Valida a conexão lendo info da catraca (agora autenticado)
      await this.request('/get_catra_info.fcgi')

      this.connected = true
      logger.info(`[Control ID] ✅ Connected successfully!`)

      // 3. Inicia renovação de sessão e polling de eventos
      this.startSessionRefresh()
      this.startEventPolling()
    } catch (error) {
      this.connected = false
      this.session = null
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
    this.stopSessionRefresh()
    this.session = null
    this.connected = false
    logger.info(`[Control ID] Disconnected`)
  }

  isConnected(): boolean {
    return this.connected
  }

  // ==========================================
  // AÇÕES — execute_actions.fcgi
  // Conforme documentação oficial:
  //   POST /execute_actions.fcgi?session=TOKEN
  //   Body: { "actions": [{ "action": "catra", "parameters": "allow=clockwise" }] }
  //
  // IMPORTANTE: "parameters" é uma STRING no formato URL query, NÃO um objeto JSON.
  // Valores válidos para catraca:
  //   - "allow=clockwise"      → sentido horário (entrada)
  //   - "allow=anticlockwise"  → sentido anti-horário (saída)
  //   - "allow=both"           → ambos os sentidos
  // ==========================================

  async grantAccess(direction: 'IN' | 'OUT'): Promise<void> {
    const allow = direction === 'IN' ? 'clockwise' : 'anticlockwise'

    logger.debug(`[Control ID] Granting access: ${allow}`)

    try {
      await this.request('/execute_actions.fcgi', {
        actions: [
          {
            action: 'catra',
            parameters: `allow=${allow}`   // STRING conforme doc oficial
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
    // A Control iD não tem um parâmetro "allow=none" documentado.
    // Para negar acesso, a prática correta é simplesmente NÃO liberar a catraca.
    // A catraca permanece travada por padrão.
    // Aqui fazemos um log de negação sem enviar comando inválido ao hardware.
    logger.debug(`[Control ID] Access denied — turnstile remains locked (no command sent)`)
  }

  // ==========================================
  // POLLING DE EVENTOS — load_objects.fcgi
  // Conforme documentação oficial:
  //   POST /load_objects.fcgi?session=TOKEN
  //   Body: { "object": "access_logs" }
  //   Headers: { "Content-Type": "application/json" }
  // ==========================================

  onCredentialRead(callback: CredentialCallback): void {
    this.credentialCallback = callback
  }

  private startEventPolling(): void {
    if (this.pollingInterval) return

    logger.debug(`[Control ID] Starting event polling (${ControlIdAdapter.POLLING_INTERVAL_MS}ms)`)

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
    }, ControlIdAdapter.POLLING_INTERVAL_MS)
  }

  // ==========================================
  // SINCRONIZAÇÃO DE USUÁRIO E FOTO FACIAL
  //
  // Criar usuário:
  //   POST /create_objects.fcgi?session=TOKEN
  //   Body: { "object": "users", "values": [{ "name": "...", "registration": "..." }] }
  //
  // Atualizar usuário existente:
  //   POST /modify_objects.fcgi?session=TOKEN
  //   Body: { "object": "users", "values": { "name": "..." }, "where": { "users": { "id": N } } }
  //
  // Enviar foto facial:
  //   POST /user_set_image.fcgi?user_id=ID&session=TOKEN
  //   Content-Type: application/octet-stream
  //   Body: raw bytes da imagem (JPEG/PNG, < 1MB)
  //
  // Conforme:
  //   https://www.controlid.com.br/docs/access-api-pt/primeiros-passos/cadastrar-usuarios-e-suas-regras/
  // ==========================================

  async syncUserFace(providerUserId: string, name: string, faceImageBuffer: Buffer): Promise<void> {
    logger.info(`[Control ID] Syncing user: ${name} (Provider ID: ${providerUserId})`)

    try {
      const numericId = parseInt(providerUserId, 10)
      if (isNaN(numericId)) {
        throw new Error(`Invalid provider user ID: ${providerUserId}`)
      }

      // 1. Verificar se o usuário já existe na catraca
      const existingUser = await this.loadUser(numericId)

      if (existingUser) {
        // Atualizar nome do usuário existente (modify_objects.fcgi)
        logger.debug(`[Control ID] User ID ${numericId} already exists — updating name...`)
        await this.request('/modify_objects.fcgi', {
          object: 'users',
          values: { name },
          where: { users: { id: numericId } }
        })
      } else {
        // Criar novo usuário (create_objects.fcgi)
        logger.debug(`[Control ID] Creating user ID ${numericId}...`)
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
      }

      // 2. Enviar foto facial via /user_set_image.fcgi
      if (faceImageBuffer && faceImageBuffer.length > 0) {
        logger.debug(`[Control ID] Sending face image for ID ${numericId} (${faceImageBuffer.length} bytes)...`)
        await this.sendFaceImage(numericId, faceImageBuffer)
      }

      logger.info(`[Control ID] ✅ User ${name} synced successfully.`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`[Control ID] ❌ Error syncing user ${name}: ${msg}`)
      throw error
    }
  }

  /**
   * Verifica se um usuário existe na Control iD pelo ID.
   * Usa load_objects.fcgi para consultar sem alterar nada.
   */
  private async loadUser(userId: number): Promise<boolean> {
    try {
      const result = (await this.request('/load_objects.fcgi', {
        object: 'users',
        where: { users: { id: userId } }
      })) as { users?: Array<{ id: number }> }

      return !!(result?.users && result.users.length > 0)
    } catch {
      return false
    }
  }

  /**
   * Envia a foto facial para a Control iD.
   * Conforme documentação oficial:
   *   POST /user_set_image.fcgi?user_id=ID&session=TOKEN
   *   Content-Type: application/octet-stream
   *   Body: raw bytes da imagem
   */
  private async sendFaceImage(userId: number, imageBuffer: Buffer): Promise<void> {
    const session = await this.ensureSession()
    const url = `${this.baseUrl}/user_set_image.fcgi?user_id=${userId}&session=${session}`

    const body = new Uint8Array(imageBuffer)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body,
      signal: AbortSignal.timeout(10000) // Timeout maior para upload de imagem
    })

    // Se sessão expirou, re-login e tenta novamente
    if (response.status === 401) {
      logger.warn('[Control ID] Session expired during face upload — re-authenticating...')
      const newSession = await this.login()
      const retryUrl = `${this.baseUrl}/user_set_image.fcgi?user_id=${userId}&session=${newSession}`

      const retryResponse = await fetch(retryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body,
        signal: AbortSignal.timeout(10000)
      })

      if (!retryResponse.ok) {
        throw new Error(`Face upload failed after re-auth: HTTP ${retryResponse.status}`)
      }
    } else if (!response.ok) {
      throw new Error(`Face upload failed: HTTP ${response.status} ${response.statusText}`)
    }

    logger.debug(`[Control ID] Face image uploaded for user ${userId}`)
  }

  // ==========================================
  // REMOÇÃO DE USUÁRIO — destroy_objects.fcgi
  // ==========================================

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

  // ==========================================
  // STATUS
  // ==========================================

  async getStatus(): Promise<'CONNECTED' | 'DISCONNECTED' | 'ERROR'> {
    try {
      // Tenta uma chamada simples para verificar se o hardware responde
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