import type { AgentConfig } from '../config'
import type { TurnstileAdapter } from '../adapters/adapter.interface'
import { getSupabase } from './client'
import { logger } from '../core/logger'
import { FaceSyncService } from '../services/FaceSyncService'
import { sqliteQueueService } from '../services/sqlite-queue.service'
import { healthCheckService } from '../services/health-check.service'

interface AccessCommand {
  id: string
  academy_id: string
  turnstile_config_id: string | null
  command_type: 'GRANT_ACCESS' | 'DENY_ACCESS' | 'SYNC_USERS' | 'SYNC_FACE' | 'REBOOT'
  payload: Record<string, unknown>
  status: string
}

let channel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null
let currentConfig: AgentConfig | null = null
let faceSyncService: FaceSyncService | null = null

export function startListener(config: AgentConfig, adapter: TurnstileAdapter): void {
  const supabase = getSupabase()
  currentConfig = config

  sqliteQueueService.initialize()

  faceSyncService = new FaceSyncService(adapter, {
    supabaseUrl: config.supabaseUrl,
    supabaseKey: config.supabaseServiceKey,
    bucket: 'avatars',
    academyId: config.academyId,
    provider: config.brand
  })

  logger.info('Realtime listener started — listening for commands from web panel...')

  channel = supabase
    .channel('agent-commands')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'access_commands',
        filter: `academy_id=eq.${config.academyId}`
      },
      async (payload) => {
        const command = payload.new as AccessCommand

        if (
          command.turnstile_config_id &&
          command.turnstile_config_id !== config.turnstileConfigId
        ) {
          return
        }

        if (command.status !== 'PENDING') return

        logger.info(`📥 Command received: ${command.command_type}`)
        await processCommand(command, adapter)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('✅ Realtime: connected and listening')
      } else if (status === 'CLOSED') {
        logger.warn('⚠️ Realtime: connection closed')
      } else if (status === 'CHANNEL_ERROR') {
        logger.error('❌ Realtime: channel error')
      }
    })

  startQueueProcessor()
}

async function startQueueProcessor(): Promise<void> {
  setInterval(async () => {
    if (faceSyncService) {
      await faceSyncService.processQueue()
    }
  }, 5000)
}

export async function stopListener(): Promise<void> {
  if (channel) {
    const supabase = getSupabase()
    await supabase.removeChannel(channel)
    channel = null
    logger.info('Realtime listener stopped')
  }

  sqliteQueueService.close()
}

async function processCommand(command: AccessCommand, adapter: TurnstileAdapter): Promise<void> {
  const supabase = getSupabase()
  const startTime = Date.now()

  try {
    await supabase.from('access_commands').update({ status: 'SENT' }).eq('id', command.id)

    switch (command.command_type) {
      case 'GRANT_ACCESS':
        await adapter.grantAccess('IN')
        logger.info('✅ Command GRANT_ACCESS executed')
        break

      case 'DENY_ACCESS':
        await adapter.denyAccess()
        logger.info('🚫 Command DENY_ACCESS executed')
        break

      case 'SYNC_USERS': {
        logger.info('🔄 Command SYNC_USERS — synchronization started')
        const { syncAcademyMembers } = await import('./userSync')
        if (currentConfig) {
          await syncAcademyMembers(currentConfig, adapter)
          logger.info('✅ User synchronization completed via web command')
        } else {
          logger.error('❌ Could not perform sync: Configuration not found')
        }
        break
      }

      case 'SYNC_FACE': {
        logger.info('👤 Command SYNC_FACE — facial synchronization started')

        const payload = command.payload as {
          user_id?: string
          user_name?: string
          user_photo_url?: string
        }

        if (payload?.user_id && payload?.user_photo_url) {
          if (faceSyncService && currentConfig) {
            faceSyncService.enqueueSync(
              payload.user_id,
              payload.user_name || 'Unknown',
              payload.user_photo_url
            )

            logger.info(`✅ Face sync enqueued for ${payload.user_name}`)
          }
        } else {
          logger.warn('SYNC_FACE without valid payload')
        }
        break
      }

      case 'REBOOT':
        logger.warn('🔄 Command REBOOT — restarting connection with turnstile')
        await adapter.disconnect()
        await adapter.connect()
        logger.info('✅ Turnstile reconnected')
        break

      default:
        logger.warn(`Unknown command: ${command.command_type}`)
    }

    if (command.command_type !== 'SYNC_FACE') {
      const elapsed = Date.now() - startTime
      await supabase
        .from('access_commands')
        .update({
          status: 'COMPLETED',
          result: { elapsed_ms: elapsed, success: true },
          processed_at: new Date().toISOString()
        })
        .eq('id', command.id)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`Error processing command ${command.command_type}: ${msg}`)

    await supabase
      .from('access_commands')
      .update({
        status: 'FAILED',
        result: { error: msg },
        processed_at: new Date().toISOString()
      })
      .eq('id', command.id)
  }
}

export async function performHealthCheck(): Promise<void> {
  const result = await healthCheckService.performFullCheck()

  logger.info('Health check result', {
    overall: result.overall,
    supabase: result.supabase,
    controlId: result.controlId,
    queue: result.queue,
    circuitBreaker: result.circuitBreaker,
    errors: result.errors
  })
}
