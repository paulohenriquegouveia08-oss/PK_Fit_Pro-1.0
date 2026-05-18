export interface DeviceStatus {
  online: boolean
  busy: boolean
  latency: number
  firmware: string
  uptime: number
  lastHeartbeat: number
  ip: string
  port: number
}

export interface FacePayload {
  userId: string
  imageBase64: string
  timestamp?: number
}

export interface FaceResponse {
  success: boolean
  confidence: number
  message?: string
  processingTime?: number
}

export interface GateAccessResult {
  success: boolean
  userId: string
  timestamp: number
  direction?: 'in' | 'out'
  message?: string
}

export interface EmulatorEvent {
  id: string
  type: 'access_granted' | 'access_denied' | 'gate_opened' | 'rotation_detected' | 'heartbeat' | 'error' | 'offline' | 'online'
  deviceId: string
  deviceBrand: string
  timestamp: number
  data?: Record<string, unknown>
}

export interface DeviceConfig {
  id: string
  brand: string
  model: string
  firmware: string
  ip: string
  port: number
  enabled?: boolean
}

export interface NetworkSimulation {
  enabled: boolean
  latencyMs: number
  packetLossRate: number
  chaosMode: boolean
  chaosFailureRate: number
}

export interface EmulatorMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageLatency: number
  activeDevices: number
  uptime: number
}

export interface EmulatorState {
  running: boolean
  port: number
  devices: DeviceConfig[]
  networkSimulation: NetworkSimulation
  metrics: EmulatorMetrics
}