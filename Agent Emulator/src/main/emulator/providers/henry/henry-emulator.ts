import { BaseTurnstileProvider } from '../base/base-turnstile-provider.js'
import type { FacePayload, FaceResponse } from '../../types/emulator.types.js'
import type { ProviderOptions } from '../base/turnstile-provider.interface.js'
import { v4 as uuidv4 } from 'uuid'

export class HenryEmulator extends BaseTurnstileProvider {
  readonly brand = 'Henry'
  readonly model = 'Prisma SF'
  readonly firmware = '2.4.1'
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

    await this.simulateProcessing(180)

    const enrolled = this.enrolledFaces.has(data.userId)

    return {
      success: true,
      confidence: enrolled ? this.generateMockConfidence() : this.generateMockConfidence() * 0.3,
      message: enrolled ? 'Match found' : 'No match',
      processingTime: 180
    }
  }

  async enrollFace(userId: string, faceData: string): Promise<boolean> {
    this.enrolledFaces.set(userId, faceData)
    await this.simulateProcessing(250)
    return true
  }

  async deleteFace(userId: string): Promise<boolean> {
    this.enrolledFaces.delete(userId)
    return true
  }
}

export function createHenryProvider(options: ProviderOptions): HenryEmulator {
  return new HenryEmulator(options)
}