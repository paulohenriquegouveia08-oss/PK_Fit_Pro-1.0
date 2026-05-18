import { contextBridge, ipcRenderer } from 'electron'

export interface EmulatorAPI {
  start: () => Promise<{ success: boolean; error?: string }>
  stop: () => Promise<{ success: boolean; error?: string }>
  getStatus: () => Promise<EmulatorStatus>
  setNetworkSimulation: (config: NetworkSimulationConfig) => Promise<{ success: boolean; config: NetworkSimulation }>
  simulateAction: (deviceId: string, action: string) => Promise<{ success: boolean; message?: string }>
  openGate: (deviceId: string, userId: string) => Promise<GateAccessResult>
  onEvent: (callback: (event: EmulatorEvent) => void) => () => void
  updateDeviceConfig: (deviceId: string, ip: string, port: number) => Promise<{ success: boolean; error?: string }>
}

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

const api: EmulatorAPI = {
  start: () => ipcRenderer.invoke('emulator:start'),
  stop: () => ipcRenderer.invoke('emulator:stop'),
  getStatus: () => ipcRenderer.invoke('emulator:getStatus'),
  setNetworkSimulation: (config) => ipcRenderer.invoke('emulator:setNetworkSimulation', config),
  simulateAction: (deviceId, action) => ipcRenderer.invoke('emulator:simulateAction', deviceId, action),
  openGate: (deviceId, userId) => ipcRenderer.invoke('emulator:openGate', deviceId, userId),
  onEvent: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: EmulatorEvent) => callback(data)
    ipcRenderer.on('emulator:event', handler)
    return () => ipcRenderer.removeListener('emulator:event', handler)
  },
  updateDeviceConfig: (deviceId, ip, port) => ipcRenderer.invoke('emulator:updateDeviceConfig', deviceId, ip, port)
}

contextBridge.exposeInMainWorld('emulatorAPI', api)