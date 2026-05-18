import { BaseTurnstileProvider } from '../base/base-turnstile-provider.js'
import type { FacePayload, FaceResponse } from '../../types/emulator.types.js'
import type { ProviderOptions } from '../base/turnstile-provider.interface.js'
import { v4 as uuidv4 } from 'uuid'

export class ControlIdEmulator extends BaseTurnstileProvider {
  readonly brand = 'Control iD'
  readonly model = 'iDFace'
  readonly firmware = '3.1.7'
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
        message: 'Device offline'
      }
    }

    await this.simulateProcessing(150)

    const enrolled = this.enrolledFaces.has(data.userId)

    if (enrolled) {
      return {
        success: true,
        confidence: this.generateMockConfidence(),
        message: 'Face matched',
        processingTime: 150
      }
    }

    return {
      success: true,
      confidence: this.generateMockConfidence() * 0.5,
      message: 'Face not enrolled',
      processingTime: 150
    }
  }

  async setUserFace(userId: string, faceData: string): Promise<boolean> {
    this.enrolledFaces.set(userId, faceData)
    await this.simulateProcessing(200)
    return true
  }

  async removeUser(userId: string): Promise<boolean> {
    this.enrolledFaces.delete(userId)
    return true
  }
}

export function createControlIdProvider(options: ProviderOptions): ControlIdEmulator {
  return new ControlIdEmulator(options)
}