export async function simulateLatency(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export function calculateJitter(baseLatency: number, jitterPercent: number = 0.1): number {
  const jitter = baseLatency * jitterPercent
  const variation = (Math.random() * 2 - 1) * jitter
  return Math.round(baseLatency + variation)
}

export class LatencySimulator {
  private baseLatency: number = 0
  private jitter: number = 0.1

  setLatency(ms: number): void {
    this.baseLatency = ms
  }

  setJitter(percent: number): void {
    this.jitter = percent
  }

  async wait(): Promise<void> {
    if (this.baseLatency <= 0) return

    const latency = calculateJitter(this.baseLatency, this.jitter)
    await simulateLatency(latency)
  }

  getLatency(): number {
    return calculateJitter(this.baseLatency, this.jitter)
  }
}