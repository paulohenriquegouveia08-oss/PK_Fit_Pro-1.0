import type { TurnstileProvider } from '../providers/base/turnstile-provider.interface.js'
import type { DeviceConfig, EmulatorMetrics, NetworkSimulation } from '../types/emulator.types.js'
import { eventBus } from './event-bus.js'

export class EmulatorManager {
  private devices = new Map<string, TurnstileProvider>()
  private deviceConfigs = new Map<string, DeviceConfig>()
  private running = false
  private port = 8080
  private startTime = Date.now()

  private networkSimulation: NetworkSimulation = {
    enabled: false,
    latencyMs: 0,
    packetLossRate: 0,
    chaosMode: false,
    chaosFailureRate: 0
  }

  private metrics: EmulatorMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    activeDevices: 0,
    uptime: 0
  }

  private latencyHistory: number[] = []

  register(config: DeviceConfig, provider: TurnstileProvider): void {
    this.devices.set(config.id, provider)
    this.deviceConfigs.set(config.id, config)
    this.updateMetrics()
  }

  unregister(id: string): void {
    const device = this.devices.get(id)
    if (device) {
      device.stop()
    }
    this.devices.delete(id)
    this.deviceConfigs.delete(id)
    this.updateMetrics()
  }

  get(id: string): TurnstileProvider | undefined {
    return this.devices.get(id)
  }

  getAll(): TurnstileProvider[] {
    return [...this.devices.values()]
  }

  getConfigs(): DeviceConfig[] {
    return [...this.deviceConfigs.values()]
  }

  getDeviceIds(): string[] {
    return [...this.devices.keys()]
  }

  async startAll(): Promise<void> {
    for (const device of this.devices.values()) {
      await device.start()
    }
    this.running = true
    this.startTime = Date.now()
    console.log('[EmulatorManager] All devices started')
  }

  async stopAll(): Promise<void> {
    for (const device of this.devices.values()) {
      await device.stop()
    }
    this.running = false
    console.log('[EmulatorManager] All devices stopped')
  }

  isRunning(): boolean {
    return this.running
  }

  setPort(port: number): void {
    this.port = port
  }

  getPort(): number {
    return this.port
  }

  setNetworkSimulation(sim: Partial<NetworkSimulation>): void {
    this.networkSimulation = { ...this.networkSimulation, ...sim }
  }

  getNetworkSimulation(): NetworkSimulation {
    return { ...this.networkSimulation }
  }

  recordRequest(success: boolean, latencyMs: number): void {
    this.metrics.totalRequests++
    if (success) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
    }

    this.latencyHistory.push(latencyMs)
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift()
    }

    this.metrics.averageLatency = Math.round(
      this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
    )
  }

  getMetrics(): EmulatorMetrics {
    return {
      ...this.metrics,
      activeDevices: this.devices.size,
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    }
  }

  private updateMetrics(): void {
    this.metrics.activeDevices = this.devices.size
  }

  shouldSimulateLatency(): boolean {
    return this.networkSimulation.enabled && this.networkSimulation.latencyMs > 0
  }

  getSimulatedLatency(): number {
    if (!this.networkSimulation.enabled) return 0
    return this.networkSimulation.latencyMs
  }

  shouldDropPacket(): boolean {
    if (!this.networkSimulation.enabled) return false
    return Math.random() < this.networkSimulation.packetLossRate
  }

  shouldSimulateFailure(): boolean {
    if (!this.networkSimulation.chaosMode) return false
    return Math.random() < this.networkSimulation.chaosFailureRate
  }
}

export const emulatorManager = new EmulatorManager()