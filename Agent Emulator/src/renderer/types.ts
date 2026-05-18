export interface EmulatorStatus {
  running: boolean
  port: number
  devices: DeviceStatus[]
  metrics: EmulatorMetrics
  network: NetworkSimulation
}

export interface DeviceConfig {
  id: string
  brand: string
  model: string
  firmware: string
  ip: string
  port: number
}

export interface DeviceStatus extends DeviceConfig {
  status?: {
    online: boolean
    busy: boolean
    latency: number
    firmware: string
    uptime: number
    lastHeartbeat: number
    ip: string
    port: number
  }
}

export interface EmulatorMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageLatency: number
  activeDevices: number
  uptime: number
}

export interface NetworkSimulation {
  enabled: boolean
  latencyMs: number
  packetLossRate: number
  chaosMode: boolean
  chaosFailureRate: number
}

export interface NetworkSimulationConfig {
  enabled?: boolean
  latencyMs?: number
  packetLossRate?: number
  chaosMode?: boolean
  chaosFailureRate?: number
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

declare global {
  interface Window {
    emulatorAPI: {
      start: () => Promise<{ success: boolean; error?: string }>
      stop: () => Promise<{ success: boolean; error?: string }>
      getStatus: () => Promise<EmulatorStatus>
      setNetworkSimulation: (config: NetworkSimulationConfig) => Promise<{ success: boolean; config: NetworkSimulation }>
      simulateAction: (deviceId: string, action: string) => Promise<{ success: boolean; message?: string }>
      openGate: (deviceId: string, userId: string) => Promise<GateAccessResult>
      onEvent: (callback: (event: EmulatorEvent) => void) => () => void
      updateDeviceConfig: (deviceId: string, ip: string, port: number) => Promise<{ success: boolean; error?: string }>
    }
  }
}

export {}