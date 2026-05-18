import type { TurnstileProvider, ProviderOptions } from './turnstile-provider.interface.js'
import type { DeviceStatus, FacePayload, FaceResponse, GateAccessResult } from '../../types/emulator.types.js'
import { eventBus } from '../../core/event-bus.js'

export abstract class BaseTurnstileProvider implements TurnstileProvider {
  abstract readonly brand: string
  abstract readonly model: string
  abstract readonly firmware: string
  abstract readonly deviceId: string

  protected ip: string
  protected port: number
  protected online = true
  protected busy = false
  protected lastHeartbeat = Date.now()
  protected startTime = Date.now()

  constructor(options: ProviderOptions) {
    this.ip = options.ip
    this.port = options.port
  }

  abstract start(): Promise<void>
  abstract stop(): Promise<void>

  updateConfig(ip: string, port: number): void {
    this.ip = ip
    this.port = port
  }

  async openGate(userId: string): Promise<GateAccessResult> {
    this.busy = true
    eventBus.emitGateOpened(this.deviceId, this.brand)
    eventBus.emitAccessGranted(this.deviceId, this.brand, userId)
    
    await this.simulateProcessing(50)
    
    setTimeout(() => {
      eventBus.emitRotationDetected(this.deviceId, this.brand)
    }, 1000)

    this.busy = false
    return {
      success: true,
      userId,
      timestamp: Date.now(),
      direction: 'in',
      message: 'Access granted'
    }
  }

  async denyAccess(userId: string, reason: string): Promise<GateAccessResult> {
    this.busy = true
    eventBus.emitAccessDenied(this.deviceId, this.brand, userId, reason)
    
    await this.simulateProcessing(30)
    
    this.busy = false
    return {
      success: false,
      userId,
      timestamp: Date.now(),
      message: reason
    }
  }

  async getStatus(): Promise<DeviceStatus> {
    return {
      online: this.online,
      busy: this.busy,
      latency: Math.floor(Math.random() * 50) + 80,
      firmware: this.firmware,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      lastHeartbeat: this.lastHeartbeat,
      ip: this.ip,
      port: this.port
    }
  }

  abstract receiveFace(data: FacePayload): Promise<FaceResponse>

  async healthCheck(): Promise<boolean> {
    this.lastHeartbeat = Date.now()
    eventBus.emitHeartbeat(this.deviceId, this.brand)
    return this.online
  }

  simulateOffline(): void {
    this.online = false
    eventBus.emitDeviceOffline(this.deviceId, this.brand)
  }

  simulateOnline(): void {
    this.online = true
    eventBus.emitDeviceOnline(this.deviceId, this.brand)
  }

  simulateTimeout(): void {
    eventBus.emitError(this.deviceId, this.brand, 'Simulated timeout')
  }

  simulateError(): void {
    eventBus.emitError(this.deviceId, this.brand, 'Simulated internal error')
  }

  protected async simulateProcessing(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  protected generateMockConfidence(): number {
    return parseFloat((0.85 + Math.random() * 0.14).toFixed(2))
  }
}