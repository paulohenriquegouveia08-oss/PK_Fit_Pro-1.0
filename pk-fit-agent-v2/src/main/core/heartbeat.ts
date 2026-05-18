import os from 'os'
import type { AgentConfig } from '../config'
import { supabase } from '../supabase/client'
import { logger } from './logger'
import packageJson from '../../../package.json'

let heartbeatTimer: ReturnType<typeof setInterval> | null = null
const startTime: Date = new Date()
let lastHeartbeatSuccess: boolean = true

export interface HeartbeatPayload {
  academyId: string
  deviceId: string
  deviceName: string
  version: string
  ipAddress: string
  uptimeSeconds: number
}

export function startHeartbeat(config: AgentConfig): void {
  const interval = config.heartbeatInterval

  logger.info(`Heartbeat started (interval: ${interval / 1000}s)`)

  sendEnhancedHeartbeat(config).catch((err) => logger.warn('Initial heartbeat error', err))

  heartbeatTimer = setInterval(async () => {
    await sendEnhancedHeartbeat(config)
  }, interval)
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    logger.info('Heartbeat stopped')
  }
}

export async function sendEnhancedHeartbeat(config: AgentConfig): Promise<boolean> {
  const startTimeMs = Date.now()
  const deviceId = getDeviceId()
  const deviceName = os.hostname()
  const ipAddress = getLocalIP()
  const version = getVersion()
  const uptimeSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000)

  const payload: HeartbeatPayload = {
    academyId: config.academyId,
    deviceId,
    deviceName,
    version,
    ipAddress,
    uptimeSeconds
  }

  try {
    const { error } = await supabase.rpc('upsert_agent_heartbeat', {
      p_academy_id: config.academyId,
      p_device_id: deviceId,
      p_device_name: deviceName,
      p_version: version,
      p_ip_address: ipAddress,
      p_uptime_seconds: uptimeSeconds
    })

    if (error) {
      logger.warn('Heartbeat RPC failed, trying fallback', { error: error.message, payload })
      await sendHeartbeatFallback(config, payload)
      return false
    }

    lastHeartbeatSuccess = true
    logger.debug('Heartbeat sent successfully', { latencyMs: Date.now() - startTimeMs })

    await checkAgentOnline(config)

    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn('Heartbeat failed', { error: msg })
    lastHeartbeatSuccess = false
    return false
  }
}

async function sendHeartbeatFallback(
  config: AgentConfig,
  payload: HeartbeatPayload
): Promise<void> {
  await supabase.from('agent_heartbeats').upsert(
    {
      academy_id: config.academyId,
      device_id: payload.deviceId,
      device_name: payload.deviceName,
      status: 'ONLINE',
      version: payload.version,
      ip_address: payload.ipAddress,
      uptime_seconds: payload.uptimeSeconds,
      last_seen: new Date().toISOString()
    },
    {
      onConflict: 'academy_id,device_id'
    }
  )
}

async function checkAgentOnline(config: AgentConfig): Promise<void> {
  const { data, error } = await supabase
    .from('agent_heartbeats')
    .select('status')
    .eq('academy_id', config.academyId)
    .eq('device_id', getDeviceId())
    .single()

  if (error || !data) {
    logger.warn('Could not verify agent online status')
    return
  }

  if (data.status !== 'ONLINE') {
    logger.warn('Agent status is not ONLINE', { status: data.status })
  }
}

export function getLastHeartbeatSuccess(): boolean {
  return lastHeartbeatSuccess
}

export function getUptime(): number {
  return Math.floor((Date.now() - startTime.getTime()) / 1000)
}

export function getDeviceId(): string {
  const stored = process.env.DEVICE_ID
  if (stored) return stored

  const { networkInterfaces } = os
  const nets = networkInterfaces()

  for (const name of Object.keys(nets)) {
    const interfaces = nets[name]
    if (!interfaces) continue

    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const hash = simpleHash(iface.mac)
        return `device-${hash}`
      }
    }
  }

  return `device-${simpleHash(os.hostname())}`
}

function getLocalIP(): string {
  const nets = os.networkInterfaces()

  for (const name of Object.keys(nets)) {
    const interfaces = nets[name]
    if (!interfaces) continue

    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) {
        return iface.address
      }
    }
  }

  return '127.0.0.1'
}

function getVersion(): string {
  return packageJson.version || '1.0.0'
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

export async function markDisconnected(config: AgentConfig): Promise<void> {
  const deviceId = getDeviceId()

  try {
    await supabase
      .from('agent_heartbeats')
      .update({ status: 'OFFLINE', last_seen: new Date().toISOString() })
      .eq('academy_id', config.academyId)
      .eq('device_id', deviceId)

    logger.info('Agent marked as OFFLINE')
  } catch (error) {
    logger.warn('Failed to mark agent as offline', { error })
  }
}
