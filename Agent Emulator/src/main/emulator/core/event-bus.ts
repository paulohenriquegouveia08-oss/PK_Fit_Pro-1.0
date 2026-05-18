import { EventEmitter } from 'events'
import type { EmulatorEvent } from '../types/emulator.types.js'

export class EventBus extends EventEmitter {
  private static instance: EventBus

  private constructor() {
    super()
    this.setMaxListeners(100)
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  emitEvent(event: EmulatorEvent): void {
    this.emit('event', event)
  }

  onEvent(callback: (event: EmulatorEvent) => void): void {
    this.on('event', callback)
  }

  removeEventListener(callback: (event: EmulatorEvent) => void): void {
    this.removeListener('event', callback)
  }

  emitAccessGranted(deviceId: string, deviceBrand: string, userId: string): void {
    this.emitEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'access_granted',
      deviceId,
      deviceBrand,
      timestamp: Date.now(),
      data: { userId }
    })
  }

  emitAccessDenied(deviceId: string, deviceBrand: string, userId: string, reason: string): void {
    this.emitEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'access_denied',
      deviceId,
      deviceBrand,
      timestamp: Date.now(),
      data: { userId, reason }
    })
  }

  emitGateOpened(deviceId: string, deviceBrand: string): void {
    this.emitEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'gate_opened',
      deviceId,
      deviceBrand,
      timestamp: Date.now()
    })
  }

  emitRotationDetected(deviceId: string, deviceBrand: string): void {
    this.emitEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'rotation_detected',
      deviceId,
      deviceBrand,
      timestamp: Date.now()
    })
  }

  emitHeartbeat(deviceId: string, deviceBrand: string): void {
    this.emitEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'heartbeat',
      deviceId,
      deviceBrand,
      timestamp: Date.now()
    })
  }

  emitError(deviceId: string, deviceBrand: string, error: string): void {
    this.emitEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'error',
      deviceId,
      deviceBrand,
      timestamp: Date.now(),
      data: { error }
    })
  }

  emitDeviceOffline(deviceId: string, deviceBrand: string): void {
    this.emitEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'offline',
      deviceId,
      deviceBrand,
      timestamp: Date.now()
    })
  }

  emitDeviceOnline(deviceId: string, deviceBrand: string): void {
    this.emitEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'online',
      deviceId,
      deviceBrand,
      timestamp: Date.now()
    })
  }
}

export const eventBus = EventBus.getInstance()