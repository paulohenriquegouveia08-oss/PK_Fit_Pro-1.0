// ==========================================
// TIPOS — Módulo Biométrico Melhorado
// ==========================================

export interface UserMapping {
  id: string
  userId: string
  academyId: string
  provider: string
  providerUserId: string
  syncedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface QueueItem {
  id: string
  userId: string
  userName: string
  photoUrl: string | null
  payload: Record<string, unknown>
  status: QueueStatus
  attempts: number
  maxAttempts: number
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  processedAt: Date | null
}

export type QueueStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'RETRYING'

export interface FaceSyncLog {
  id: string
  userId: string
  academyId: string
  provider: string
  providerUserId: string | null
  status: SyncLogStatus
  message: string | null
  durationMs: number | null
  rawResponse: string | null
  createdAt: Date
}

export type SyncLogStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'RETRYING'

export interface AgentHeartbeat {
  id: string
  academyId: string
  deviceId: string
  deviceName: string | null
  status: HeartbeatStatus
  version: string | null
  ipAddress: string | null
  uptimeSeconds: number
  lastSeen: Date
  createdAt: Date
}

export type HeartbeatStatus = 'ONLINE' | 'OFFLINE' | 'ERROR'

export interface CircuitBreakerState {
  provider: string
  state: CircuitBreakerMode
  failureCount: number
  lastFailureAt: Date | null
  lastSuccessAt: Date | null
  openedAt: Date | null
}

export type CircuitBreakerMode = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface FaceDetectionResult {
  hasFace: boolean
  faceCount: number
  isBlurry: boolean
  isTooSmall: boolean
  isPoorLighting: boolean
  isOffCenter: boolean
  confidence: number
  boundingBox?: FaceBoundingBox
  landmarks?: FaceLandmarks
}

export interface FaceBoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface FaceLandmarks {
  leftEye: Point
  rightEye: Point
  nose: Point
  leftMouth: Point
  rightMouth: Point
}

export interface Point {
  x: number
  y: number
}

export interface ProcessedImageResult {
  buffer: Buffer
  width: number
  height: number
  format: string
  size: number
}

export interface HealthCheckResult {
  overall: boolean
  supabase: boolean
  controlId: boolean
  storage: boolean
  queue: boolean
  realtime: boolean
  circuitBreaker: boolean
  errors: string[]
}

export interface FaceSyncInput {
  userId: string
  userName: string
  photoUrl: string
  providerUserId: string
  academyId: string
  provider: string
}

export interface FaceSyncOutput {
  success: boolean
  userId: string
  providerUserId?: string
  message: string
  errorCode?: string
  durationMs?: number
}