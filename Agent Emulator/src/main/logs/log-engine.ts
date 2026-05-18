export class LogEngine {
  log(type: string, message: string, payload?: unknown) {
    console.log(JSON.stringify({
      type,
      message,
      payload,
      timestamp: Date.now()
    }))
  }
}

export const logEngine = new LogEngine()
