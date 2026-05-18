export type ChaosType = 'failure' | 'timeout' | 'latency' | 'offline' | 'error_500'

export interface ChaosConfig {
  enabled: boolean
  failureRate: number
  timeoutRate: number
  latencySpikeRate: number
  offlineRate: number
  error500Rate: number
}

export class ChaosMode {
  private config: ChaosConfig = {
    enabled: false,
    failureRate: 0.1,
    timeoutRate: 0.05,
    latencySpikeRate: 0.15,
    offlineRate: 0.02,
    error500Rate: 0.08
  }

  configure(config: Partial<ChaosConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): ChaosConfig {
    return { ...this.config }
  }

  enable(): void {
    this.config.enabled = true
  }

  disable(): void {
    this.config.enabled = false
  }

  shouldFail(): boolean {
    if (!this.config.enabled) return false
    return Math.random() < this.config.failureRate
  }

  shouldTimeout(): boolean {
    if (!this.config.enabled) return false
    return Math.random() < this.config.timeoutRate
  }

  shouldSpikeLatency(): boolean {
    if (!this.config.enabled) return false
    return Math.random() < this.config.latencySpikeRate
  }

  shouldGoOffline(): boolean {
    if (!this.config.enabled) return false
    return Math.random() < this.config.offlineRate
  }

  shouldReturn500(): boolean {
    if (!this.config.enabled) return false
    return Math.random() < this.config.error500Rate
  }

  getRandomChaosType(): ChaosType | null {
    if (!this.config.enabled) return null

    const types: ChaosType[] = ['failure', 'timeout', 'latency', 'offline', 'error_500']
    const rand = Math.random()

    if (rand < this.config.failureRate) return 'failure'
    if (rand < this.config.failureRate + this.config.timeoutRate) return 'timeout'
    if (rand < this.config.failureRate + this.config.timeoutRate + this.config.latencySpikeRate) return 'latency'
    if (rand < this.config.failureRate + this.config.timeoutRate + this.config.latencySpikeRate + this.config.offlineRate) return 'offline'
    if (rand < this.config.failureRate + this.config.timeoutRate + this.config.latencySpikeRate + this.config.offlineRate + this.config.error500Rate) return 'error_500'

    return null
  }

  static shouldFail(rate: number = 0.1): boolean {
    return Math.random() < rate
  }

  static async randomDelay(min: number = 100, max: number = 5000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min)
    return new Promise(resolve => setTimeout(resolve, delay))
  }
}