import type { LogLevel } from '../config'

// ==========================================
// LOGGER — Logging local com níveis e cores
// ==========================================

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m', // cinza
  info: '\x1b[36m', // ciano
  warn: '\x1b[33m', // amarelo
  error: '\x1b[31m' // vermelho
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'

class Logger {
  private minLevel: LogLevel = 'info'
  public onLogCallback?: (logEntry: {
    level: string
    message: string
    data?: unknown
    timestamp: string
  }) => void

  setLevel(level: LogLevel): void {
    this.minLevel = level
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel]
  }

  private formatTimestamp(): string {
    return new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return

    const color = LEVEL_COLORS[level]
    const tag = level.toUpperCase().padEnd(5)
    const timestamp = this.formatTimestamp()
    const prefix = `${color}${BOLD}[${tag}]${RESET} ${color}${timestamp}${RESET}`

    if (this.onLogCallback) {
      this.onLogCallback({ level: level, message, data, timestamp })
    }

    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data)
    } else {
      console.log(`${prefix} ${message}`)
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data)
  }

  // Divider para facilitar leitura no console
  divider(label?: string): void {
    if (!this.shouldLog('info')) return
    const line = '═'.repeat(50)
    if (label) {
      console.log(`\n\x1b[36m╔${line}╗\x1b[0m`)
      console.log(`\x1b[36m║\x1b[0m ${BOLD}${label.padEnd(48)}${RESET} \x1b[36m║\x1b[0m`)
      console.log(`\x1b[36m╚${line}╝\x1b[0m\n`)
    } else {
      console.log(`\x1b[90m${'─'.repeat(52)}\x1b[0m`)
    }
  }

  // Log especial para eventos de acesso (alta visibilidade)
  access(granted: boolean, userName: string, reason: string): void {
    if (this.onLogCallback) {
      this.onLogCallback({
        level: granted ? 'success' : 'error',
        message: `${granted ? '✅ ACESSO LIBERADO' : '❌ ACESSO NEGADO'} ${userName} — ${reason}`,
        timestamp: this.formatTimestamp()
      })
    }
    if (granted) {
      console.log(
        `\n  \x1b[42m\x1b[97m ✅ ACESSO LIBERADO \x1b[0m  ${BOLD}${userName}${RESET} — ${reason}\n`
      )
    } else {
      console.log(
        `\n  \x1b[41m\x1b[97m ❌ ACESSO NEGADO   \x1b[0m  ${BOLD}${userName}${RESET} — ${reason}\n`
      )
    }
  }
}

// Singleton
export const logger = new Logger()
