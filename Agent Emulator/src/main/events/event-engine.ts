export class EventEngine {
  private events: any[] = []
  private idCounter = 1

  addAccessGranted(userId: number) {
    this.events.push({
      id: this.idCounter++,
      event: 7, // Biometric/Face
      user_id: userId,
      time: Math.floor(Date.now() / 1000)
    })
  }

  addAccessDenied(userId: number) {
    this.events.push({
      id: this.idCounter++,
      event: 12, // Generic denied
      user_id: userId,
      time: Math.floor(Date.now() / 1000)
    })
  }

  getEvents() {
    return this.events
  }
}

export const eventEngine = new EventEngine()
