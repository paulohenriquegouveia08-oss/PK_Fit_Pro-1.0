import type { AgentConfig } from '../config'
import type { TurnstileAdapter } from './adapter.interface'
import { ControlIdAdapter } from './controlid.adapter'
import { TopDataAdapter } from './topdata.adapter'
import { HenryAdapter } from './henry.adapter'
import { logger } from '../core/logger'

/**
 * Factory — cria o adaptador correto baseado na marca configurada.
 * O Agent não precisa saber qual marca é, só usa a interface.
 */
export function createAdapter(config: AgentConfig): TurnstileAdapter {
  logger.info(`Criando adaptador para marca: ${config.brand}`)

  const adapterConfig = {
    ip: config.ip,
    port: config.port,
    authUser: config.authUser,
    authPassword: config.authPassword
  }

  switch (config.brand) {
    case 'CONTROL_ID':
      return new ControlIdAdapter(adapterConfig)

    case 'TOP_DATA':
      return new TopDataAdapter(adapterConfig.ip, adapterConfig.port)

    case 'HENRY':
      return new HenryAdapter(
        adapterConfig.ip,
        adapterConfig.port,
        adapterConfig.authUser,
        adapterConfig.authPassword
      )

    default:
      throw new Error(`❌ Marca de catraca não suportada: ${config.brand}`)
  }
}
