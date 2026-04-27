import type { AgentConfig } from '../config'
import type { TurnstileAdapter } from '../adapters/adapter.interface'
import { getSupabase } from './client'
import { logger } from '../core/logger'

// ==========================================
// REALTIME LISTENER
// Escuta comandos inseridos na tabela
// access_commands pelo painel web
// ==========================================

interface AccessCommand {
  id: string
  academy_id: string
  turnstile_config_id: string | null
  command_type: 'GRANT_ACCESS' | 'DENY_ACCESS' | 'SYNC_USERS' | 'REBOOT'
  payload: Record<string, unknown>
  status: string
}

let channel: ReturnType<ReturnType<typeof getSupabase>['channel']> | null = null
let currentConfig: AgentConfig | null = null

/**
 * Inicia o listener que escuta novos comandos via Supabase Realtime
 */
export function startListener(config: AgentConfig, adapter: TurnstileAdapter): void {
  const supabase = getSupabase()
  currentConfig = config

  logger.info('Realtime listener iniciado — escutando comandos do painel web...')

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

        // Ignorar comandos que não são para esta catraca
        if (
          command.turnstile_config_id &&
          command.turnstile_config_id !== config.turnstileConfigId
        ) {
          return
        }

        // Ignorar comandos já processados
        if (command.status !== 'PENDING') return

        logger.info(`📥 Comando recebido: ${command.command_type}`)
        await processCommand(command, adapter)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('✅ Realtime: conectado e escutando')
      } else if (status === 'CLOSED') {
        logger.warn('⚠️ Realtime: conexão fechada')
      } else if (status === 'CHANNEL_ERROR') {
        logger.error('❌ Realtime: erro no canal')
      }
    })
}

/**
 * Para o listener
 */
export async function stopListener(): Promise<void> {
  if (channel) {
    const supabase = getSupabase()
    await supabase.removeChannel(channel)
    channel = null
    logger.info('Realtime listener parado')
  }
}

/**
 * Processa um comando recebido do painel web
 */
async function processCommand(command: AccessCommand, adapter: TurnstileAdapter): Promise<void> {
  const supabase = getSupabase()
  const startTime = Date.now()

  try {
    // Marcar como "em processamento"
    await supabase.from('access_commands').update({ status: 'SENT' }).eq('id', command.id)

    // Executar o comando
    switch (command.command_type) {
      case 'GRANT_ACCESS':
        await adapter.grantAccess('IN')
        logger.info('✅ Comando GRANT_ACCESS executado')
        break

      case 'DENY_ACCESS':
        await adapter.denyAccess()
        logger.info('🚫 Comando DENY_ACCESS executado')
        break

      case 'SYNC_USERS':
        logger.info('🔄 Comando SYNC_USERS — sincronização iniciada')
        const { syncAcademyMembers } = await import('./userSync')
        if (currentConfig) {
          await syncAcademyMembers(currentConfig, adapter)
          logger.info('✅ Sincronização de usuários finalizada via comando web')
        } else {
          logger.error('❌ Não foi possível realizar sync: Configuração não encontrada')
        }
        break

      case 'REBOOT':
        logger.warn('🔄 Comando REBOOT — reiniciando conexão com a catraca')
        await adapter.disconnect()
        await adapter.connect()
        logger.info('✅ Catraca reconectada')
        break

      default:
        logger.warn(`Comando desconhecido: ${command.command_type}`)
    }

    // Marcar como concluído
    const elapsed = Date.now() - startTime
    await supabase
      .from('access_commands')
      .update({
        status: 'COMPLETED',
        result: { elapsed_ms: elapsed, success: true },
        processed_at: new Date().toISOString()
      })
      .eq('id', command.id)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error(`Erro ao processar comando ${command.command_type}: ${msg}`)

    // Marcar como falha
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
