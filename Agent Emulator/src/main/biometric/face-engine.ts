export class FaceEngine {
  private faces = new Map<number, { image: string, created_at: number }>()

  saveFace(userId: number, base64: string) {
    this.faces.set(userId, {
      image: base64,
      created_at: Date.now()
    })
  }

  compare(userId: number, base64: string): boolean {
    const existing = this.faces.get(userId)

    if (!existing) {
      return false
    }

    // A real face engine would compare the biometrics, 
    // but here we just simulate success if the user has a face enrolled
    return true
  }

  getFacesCount(): number {
    return this.faces.size
  }
}

export const faceEngine = new FaceEngine()
