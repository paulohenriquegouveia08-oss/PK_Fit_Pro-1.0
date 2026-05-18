import { BaseTurnstileProvider } from '../base/base-turnstile-provider.js'
import type { FacePayload, FaceResponse } from '../../types/emulator.types.js'
import type { ProviderOptions } from '../base/turnstile-provider.interface.js'
import { v4 as uuidv4 } from 'uuid'

export class TopDataEmulator extends BaseTurnstileProvider {
  readonly brand = 'TopData'
  readonly model = 'Inner'
  readonly firmware = '1.8.3'
  readonly deviceId: string

  private enrolledFaces = new Map<string, string>()

  constructor(options: ProviderOptions) {
    super(options)
    this.deviceId = options.deviceId || uuidv4()
  }

  async start(): Promise<void> {
    this.online = true
    this.startTime = Date.now()
    console.log(`[${this.brand}] Device ${this.deviceId} started at ${this.ip}:${this.port}`)
  }

  async stop(): Promise<void> {
    this.online = false
    console.log(`[${this.brand}] Device ${this.deviceId} stopped`)
  }

  async receiveFace(data: FacePayload): Promise<FaceResponse> {
    if (!this.online) {
      return {
        success: false,
        confidence: 0,
        message: 'Dispositivo offline'
      }
    }

    await this.simulateProcessing(120)

    const enrolled = this.enrolledFaces.has(data.userId)

    return {
      success: true,
      confidence: enrolled ? this.generateMockConfidence() : 0.25,
      message: enrolled ? 'Biometria validada' : 'Biometria nao encontrada',
      processingTime: 120
    }
  }

  async cadastrarBiometria(userId: string, faceData: string): Promise<boolean> {
    this.enrolledFaces.set(userId, faceData)
    await this.simulateProcessing(200)
    return true
  }

  async excluirBiometria(userId: string): Promise<boolean> {
    this.enrolledFaces.delete(userId)
    return true
  }
}

export function createTopDataProvider(options: ProviderOptions): TopDataEmulator {
  return new TopDataEmulator(options)
}