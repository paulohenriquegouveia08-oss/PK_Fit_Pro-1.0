import * as net from 'net'
import type { TurnstileAdapter, CredentialCallback, CredentialEvent } from './adapter.interface'
import { logger } from '../core/logger'

// ==========================================
// HENRY ADAPTER — HTTP + TCP Communication
// O Henry possui um app web embarcado acessível
// via HTTP e também comunica via TCP (porta 3000)
// ==========================================

export class HenryAdapter implements TurnstileAdapter {
  readonly brandName = 'Henry'

  private ip: string
  private port: number
  private authUser: string
  private authPassword: string
  private connected: boolean = false
  private credentialCallback: CredentialCallback | null = null
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private tcpSocket: net.Socket | null = null
  private tcpConnected: boolean = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts: number = 0
  private readonly maxReconnectAttempts = 10
  private readonly reconnectDelay = 5000
  private readonly tcpPort = 3000 // Porta TCP padrão Henry
  private dataBuffer: Buffer = Buffer.alloc(0)
  private lastEventId: number = 0

  constructor(ip: string, port: number, authUser: string, authPassword: string) {
    this.ip = ip
    this.port = port || 80
    this.authUser = authUser || 'primmesf' // Credenciais padrão Henry
    this.authPassword = authPassword || '121314'
  }

  // ==========================================
  // URL base e HTTP helpers
  // ==========================================

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

  private async httpRequest(
    endpoint: string,
    method: string = 'GET',
    body?: unknown
  ): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`
    const options: RequestInit = {
      method,
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

  // ==========================================
  // CONEXÃO (HTTP + TCP)
  // ==========================================

  async connect(): Promise<void> {
    logger.info(`[Henry] Conectando ao equipamento em ${this.ip}...`)

    // 1. Testar conexão HTTP com o app web embarcado
    try {
      await this.httpRequest('/api/system/status')
      logger.info(`[Henry] ✅ Conexão HTTP estabelecida`)
    } catch (httpError) {
      // Tentar endpoint alternativo (varia por modelo/firmware)
      try {
        await this.httpRequest('/status')
        logger.info(`[Henry] ✅ Conexão HTTP estabelecida (endpoint alternativo)`)
      } catch {
        logger.warn(`[Henry] ⚠️ App web não respondeu — tentando apenas TCP`)
      }
    }

    // 2. Conectar via TCP para eventos em tempo real
    try {
      await this.connectTcp()
    } catch (tcpError) {
      logger.warn(
        `[Henry] ⚠️ TCP não disponível: ${tcpError instanceof Error ? tcpError.message : tcpError}`
      )
      logger.info(`[Henry] Usando apenas polling HTTP para eventos`)
    }

    this.connected = true
    logger.info(`[Henry] ✅ Conectado com sucesso!`)
  }

  private connectTcp(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout TCP (5s)'))
      }, 5000)

      this.tcpSocket = net.createConnection({
        host: this.ip,
        port: this.tcpPort
      })

      this.tcpSocket.on('connect', () => {
        clearTimeout(timeout)
        this.tcpConnected = true
        this.reconnectAttempts = 0
        logger.info(`[Henry] ✅ Conexão TCP estabelecida na porta ${this.tcpPort}`)
        resolve()
      })

      this.tcpSocket.on('data', (data: Buffer) => {
        this.handleTcpData(data)
      })

      this.tcpSocket.on('error', (error: Error) => {
        if (!this.tcpConnected) {
          clearTimeout(timeout)
          reject(error)
        } else {
          logger.error(`[Henry] Erro TCP: ${error.message}`)
        }
      })

      this.tcpSocket.on('close', () => {
        const wasConnected = this.tcpConnected
        this.tcpConnected = false

        if (wasConnected && this.connected) {
          logger.warn(`[Henry] Conexão TCP perdida — reconectando...`)
          this.scheduleTcpReconnect()
        }
      })
    })
  }

  private scheduleTcpReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`[Henry] ❌ Máximo de reconexões TCP atingido — usando apenas HTTP`)
      this.startHttpPolling()
      return
    }

    this.reconnectAttempts++
    logger.info(
      `[Henry] Reconectando TCP em ${this.reconnectDelay / 1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    )

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connectTcp()
      } catch {
        logger.warn(`[Henry] Falha na reconexão TCP`)
      }
    }, this.reconnectDelay)
  }

  async disconnect(): Promise<void> {
    // Parar polling HTTP
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }

    // Parar reconexão
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Fechar TCP
    if (this.tcpSocket) {
      this.tcpSocket.removeAllListeners()
      this.tcpSocket.destroy()
      this.tcpSocket = null
      this.tcpConnected = false
    }

    this.connected = false
    logger.info(`[Henry] Desconectado`)
  }

  isConnected(): boolean {
    return this.connected
  }

  // ==========================================
  // PROCESSAMENTO DE DADOS TCP
  // ==========================================

  private handleTcpData(data: Buffer): void {
    this.dataBuffer = Buffer.concat([this.dataBuffer, data])

    // Protocolo Henry: pacotes delimitados
    while (this.dataBuffer.length >= 4) {
      // Tentar identificar um pacote completo
      const packetLength = this.dataBuffer[1] || 0

      if (this.dataBuffer.length < packetLength + 2) {
        break // Aguardar mais dados
      }

      const packet = this.dataBuffer.subarray(0, packetLength + 2)
      this.dataBuffer = this.dataBuffer.subarray(packetLength + 2)

      this.processTcpPacket(packet)
    }
  }

  private processTcpPacket(packet: Buffer): void {
    logger.debug(`[Henry] Pacote TCP: [${packet.toString('hex')}]`)

    if (packet.length < 3) return

    const commandType = packet[2]

    // Detectar eventos de credencial
    // Os códigos dependem do modelo/firmware, mas seguem padrão similar
    switch (commandType) {
      case 0x01: // Cartão de proximidade
      case 0x02: {
        // Smart card
        const cardData = packet.subarray(3).toString('ascii').replace(/\0/g, '').trim()
        if (cardData && this.credentialCallback) {
          this.credentialCallback({
            type: 'CARD',
            rawValue: cardData,
            timestamp: new Date()
          })
          logger.debug(`[Henry] Cartão lido via TCP: ${cardData}`)
        }
        break
      }

      case 0x03: {
        // Biometria
        const bioId = packet.subarray(3).toString('ascii').replace(/\0/g, '').trim()
        if (bioId && this.credentialCallback) {
          this.credentialCallback({
            type: 'BIOMETRIC',
            rawValue: bioId,
            timestamp: new Date()
          })
          logger.debug(`[Henry] Biometria lida via TCP: ${bioId}`)
        }
        break
      }

      case 0x04: {
        // Reconhecimento facial
        const faceId = packet.subarray(3).toString('ascii').replace(/\0/g, '').trim()
        if (faceId && this.credentialCallback) {
          this.credentialCallback({
            type: 'FACIAL',
            rawValue: faceId,
            timestamp: new Date()
          })
          logger.debug(`[Henry] Facial lido via TCP: ${faceId}`)
        }
        break
      }

      default:
        logger.debug(`[Henry] Pacote TCP não tratado: type=0x${commandType?.toString(16)}`)
    }
  }

  // ==========================================
  // POLLING HTTP (fallback se TCP não disponível)
  // ==========================================

  private startHttpPolling(): void {
    if (this.pollingInterval) return

    logger.info(`[Henry] Iniciando polling HTTP de eventos (1s)`)

    this.pollingInterval = setInterval(async () => {
      if (!this.connected || !this.credentialCallback) return

      try {
        // Buscar eventos recentes via app web embarcado
        const result = (await this.httpRequest('/api/access/events?limit=1&order=desc')) as {
          events?: Array<{
            id: number
            type?: string
            credential?: string
            user_id?: string
          }>
        }

        const events = result?.events
        if (!events || events.length === 0) return

        const latest = events[0]
        if (latest.id <= this.lastEventId) return

        this.lastEventId = latest.id

        // Mapear tipo de credencial
        let type: CredentialEvent['type'] = 'CARD'
        if (latest.type === 'biometric' || latest.type === 'bio') type = 'BIOMETRIC'
        if (latest.type === 'facial' || latest.type === 'face') type = 'FACIAL'
        if (latest.type === 'qrcode' || latest.type === 'qr') type = 'QR_CODE'

        const event: CredentialEvent = {
          type,
          rawValue: String(latest.credential || latest.user_id || latest.id),
          timestamp: new Date()
        }

        logger.debug(`[Henry] Credencial via HTTP: ${type} — ${event.rawValue}`)
        this.credentialCallback(event)
      } catch (error) {
        if (this.connected) {
          logger.debug(`[Henry] Erro no polling HTTP: ${error}`)
        }
      }
    }, 1000)
  }

  // ==========================================
  // CONTROLE DE ACESSO (via HTTP)
  // ==========================================

  async grantAccess(direction: 'IN' | 'OUT'): Promise<void> {
    logger.debug(`[Henry] Liberando catraca: ${direction}`)

    try {
      // Tentar via HTTP primeiro (app web embarcado)
      await this.httpRequest('/api/access/grant', 'POST', {
        direction: direction === 'IN' ? 'clockwise' : 'anticlockwise'
      })
      logger.debug(`[Henry] Catraca liberada via HTTP (${direction})`)
    } catch {
      // Fallback: tentar via TCP
      if (this.tcpConnected && this.tcpSocket) {
        const dirByte = direction === 'IN' ? 0x01 : 0x02
        const command = Buffer.from([0x02, 0x03, 0x10, dirByte, 0x03])
        this.tcpSocket.write(command)
        logger.debug(`[Henry] Catraca liberada via TCP (${direction})`)
      } else {
        logger.error(`[Henry] Falha ao liberar catraca — sem comunicação`)
      }
    }
  }

  async denyAccess(): Promise<void> {
    logger.debug(`[Henry] Acesso negado`)

    try {
      await this.httpRequest('/api/access/deny', 'POST', {})
    } catch {
      // Fallback: TCP
      if (this.tcpConnected && this.tcpSocket) {
        const command = Buffer.from([0x02, 0x03, 0x10, 0x00, 0x03])
        this.tcpSocket.write(command)
        logger.debug(`[Henry] Negação enviada via TCP`)
      } else {
        logger.debug(`[Henry] Negação: sem comunicação ativa (não crítico)`)
      }
    }
  }

  // ==========================================
  // EVENTOS DE CREDENCIAL
  // ==========================================

  onCredentialRead(callback: CredentialCallback): void {
    this.credentialCallback = callback

    // Se TCP está conectado, os eventos já são recebidos automaticamente
    if (this.tcpConnected) {
      logger.debug(`[Henry] Callback registrado — escutando eventos TCP`)
    } else {
      // Sem TCP, usar polling HTTP
      this.startHttpPolling()
      logger.debug(`[Henry] Callback registrado — usando polling HTTP`)
    }
  }

  // ==========================================
  // SINCRONIZAÇÃO DE USUÁRIOS E FACES
  // ==========================================

  /**
   * Gera um ID numérico a partir da UUID do Supabase.
   */
  private generateNumericId(uuid: string): number {
    let hash = 0
    for (let i = 0; i < uuid.length; i++) {
      const char = uuid.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  private async downloadImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Falha ao baixar imagem: ${response.statusText}`)
    const buffer = await response.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  }

  async syncUserFace(userId: string, name: string, photoUrl: string): Promise<void> {
    const numericId = this.generateNumericId(userId)
    logger.info(`[Henry] Sincronizando usuário: ${name} (ID: ${numericId})`)

    try {
      // 1. Criar ou atualizar o usuário na Henry
      await this.httpRequest('/api/users', 'POST', {
        id: numericId,
        name: name,
        card: String(numericId),
        role: 'user'
      })

      // 2. Se houver foto, enviar a face
      if (photoUrl) {
        logger.debug(`[Henry] Enviando face para ID ${numericId}...`)
        const base64Image = await this.downloadImageAsBase64(photoUrl)

        await this.httpRequest('/api/faces', 'POST', {
          user_id: numericId,
          image: base64Image
        })
      }

      logger.info(`[Henry] ✅ Usuário ${name} sincronizado com sucesso.`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(`[Henry] ❌ Erro ao sincronizar usuário ${name}: ${msg}`)
      throw error
    }
  }

  async removeUser(userId: string): Promise<void> {
    const numericId = this.generateNumericId(userId)
    logger.info(`[Henry] Removendo usuário ID: ${numericId}`)

    try {
      await this.httpRequest(`/api/users/${numericId}`, 'DELETE')
      logger.info(`[Henry] ✅ Usuário removido do hardware.`)
    } catch (error) {
      logger.error(`[Henry] ❌ Erro ao remover usuário: ${error}`)
    }
  }

  // ==========================================
  // STATUS
  // ==========================================

  async getStatus(): Promise<'CONNECTED' | 'DISCONNECTED' | 'ERROR'> {
    if (!this.connected) return 'DISCONNECTED'

    try {
      await this.httpRequest('/api/system/status')
      return 'CONNECTED'
    } catch {
      try {
        await this.httpRequest('/status')
        return 'CONNECTED'
      } catch {
        if (this.tcpConnected) return 'CONNECTED'
        this.connected = false
        return 'ERROR'
      }
    }
  }
}
