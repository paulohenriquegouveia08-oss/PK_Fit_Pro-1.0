import type { TurnstileAdapter, CredentialCallback, CredentialEvent } from './adapter.interface'
import { logger } from '../core/logger'

// ==========================================
// CONTROL ID ADAPTER — REST API
// Comunicação via HTTP com endpoints .fcgi
// ==========================================

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

  constructor(ip: string, port: number, authUser: string, authPassword: string) {
    this.ip = ip
    this.port = port
    this.authUser = authUser
    this.authPassword = authPassword
  }

  // ==========================================
  // URL base
  // ==========================================

  private get baseUrl(): string {
    return `http://${this.ip}:${this.port}`
  }

  // ==========================================
  // HTTP helpers
  // ==========================================

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
      signal: AbortSignal.timeout(5000) // timeout de 5s
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

  // ==========================================
  // CONEXÃO
  // ==========================================

  async connect(): Promise<void> {
    logger.info(`[Control ID] Conectando à catraca em ${this.ip}:${this.port}...`)

    try {
      // Testa conexão buscando info da catraca
      await this.request('/get_catra_info.fcgi')
      this.connected = true
      logger.info(`[Control ID] ✅ Conectado com sucesso!`)

      // Inicia polling de eventos de credencial
      this.startEventPolling()
    } catch (error) {
      this.connected = false
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`[Control ID] ❌ Falha na conexão: ${msg}`)
      throw new Error(`Não foi possível conectar à catraca Control ID: ${msg}`)
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
    this.connected = false
    logger.info(`[Control ID] Desconectado`)
  }

  isConnected(): boolean {
    return this.connected
  }

  // ==========================================
  // CONTROLE DE ACESSO
  // ==========================================

  async grantAccess(direction: 'IN' | 'OUT'): Promise<void> {
    // clockwise = sentido horário (entrada), anticlockwise = anti-horário (saída)
    const allow = direction === 'IN' ? 'clockwise' : 'anticlockwise'

    logger.debug(`[Control ID] Liberando catraca: ${allow}`)

    try {
      await this.request('/execute_actions.fcgi', {
        actions: [
          {
            action: 'catra',
            parameters: { allow }
          }
        ]
      })

      logger.debug(`[Control ID] Catraca liberada (${direction})`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`[Control ID] Erro ao liberar: ${msg}`)
      throw error
    }
  }

  async denyAccess(): Promise<void> {
    logger.debug(`[Control ID] Acesso negado — catraca travada`)

    try {
      // Aciona buzzer/LED vermelho se disponível
      await this.request('/execute_actions.fcgi', {
        actions: [
          {
            action: 'catra',
            parameters: { allow: 'none' }
          }
        ]
      })
    } catch (error) {
      // Deny é "não fazer nada" na catraca, então falha silenciosa é ok
      logger.debug(`[Control ID] Erro ao sinalizar negação (não crítico): ${error}`)
    }
  }

  // ==========================================
  // EVENTOS DE CREDENCIAL
  // ==========================================

  onCredentialRead(callback: CredentialCallback): void {
    this.credentialCallback = callback
  }

  /**
   * Polling de eventos de acesso.
   * A Control ID notifica eventos via load_objects.
   * Poll a cada 500ms para resposta rápida.
   */
  private startEventPolling(): void {
    if (this.pollingInterval) return

    logger.debug(`[Control ID] Iniciando polling de eventos (500ms)`)

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
        if (latest.id <= this.lastEventId) return // já processado

        this.lastEventId = latest.id

        // Determinar tipo de credencial
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

        logger.debug(`[Control ID] Credencial lida: ${type} — ${credential.rawValue}`)
        this.credentialCallback(credential)
      } catch (error) {
        // Polling silencioso — erros podem ser transientes
        if (this.connected) {
          logger.debug(`[Control ID] Erro no polling: ${error}`)
        }
      }
    }, 500) // 500ms = resposta em no máximo meio segundo
  }

  // ==========================================
  // SINCRONIZAÇÃO DE USUÁRIOS E FACES
  // ==========================================

  /**
   * Gera um ID numérico a partir da UUID do Supabase.
   * Necessário pois a Control ID exige IDs numéricos (int).
   */
  private generateNumericId(uuid: string): number {
    let hash = 0
    for (let i = 0; i < uuid.length; i++) {
      const char = uuid.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit int
    }
    return Math.abs(hash)
  }

  /**
   * Baixa uma imagem de uma URL e converte para Base64.
   */
  private async downloadImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Falha ao baixar imagem: ${response.statusText}`)
    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  }

  async syncUserFace(userId: string, name: string, photoUrl: string): Promise<void> {
    const numericId = this.generateNumericId(userId)
    logger.info(`[Control ID] Sincronizando usuário: ${name} (ID: ${numericId})`)

    try {
      // 1. Criar ou atualizar o usuário na iDFace
      // Usamos upsert: true se disponível, ou lidamos com erro se já existir
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

      // 2. Se houver foto, baixar e enviar o rosto
      if (photoUrl) {
        logger.debug(`[Control ID] Baixando e enviando face para ID ${numericId}...`)
        const base64Image = await this.downloadImageAsBase64(photoUrl)

        // Cadastrar a face
        // Nota: O endpoint set_user_face.fcgi facilita esse processo na iDFace
        await this.request('/set_user_face.fcgi', {
          user_id: numericId,
          face_image: base64Image
        })
      }

      logger.info(`[Control ID] ✅ Usuário ${name} sincronizado com sucesso.`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`[Control ID] ❌ Erro ao sincronizar usuário ${name}: ${msg}`)
      throw error
    }
  }

  async removeUser(userId: string): Promise<void> {
    const numericId = this.generateNumericId(userId)
    logger.info(`[Control ID] Removendo usuário ID: ${numericId}`)

    try {
      await this.request('/destroy_objects.fcgi', {
        object: 'users',
        where: {
          users: { id: numericId }
        }
      })
      logger.info(`[Control ID] ✅ Usuário removido do hardware.`)
    } catch (error) {
      logger.error(`[Control ID] ❌ Erro ao remover usuário: ${error}`)
    }
  }

  // ==========================================
  // INFO
  // ==========================================

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
