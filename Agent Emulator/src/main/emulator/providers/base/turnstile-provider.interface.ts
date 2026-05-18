import type { DeviceStatus, FacePayload, FaceResponse, GateAccessResult } from '../../types/emulator.types.js'

export interface TurnstileProvider {
  readonly brand: string
  readonly model: string
  readonly firmware: string
  readonly deviceId: string

  start(): Promise<void>
  stop(): Promise<void>
  updateConfig(ip: string, port: number): void

  openGate(userId: string): Promise<GateAccessResult>
  denyAccess(userId: string, reason: string): Promise<GateAccessResult>

  getStatus(): Promise<DeviceStatus>

  receiveFace(data: FacePayload): Promise<FaceResponse>

  healthCheck(): Promise<boolean>

  simulateOffline(): void
  simulateOnline(): void
  simulateTimeout(): void
  simulateError(): void
}

export interface ProviderOptions {
  ip: string
  port: number
  deviceId: string
  simulateLatency?: number
}

export interface ProviderFactory {
  create(options: ProviderOptions): TurnstileProvider
}