export interface FaceDetectionResult {
  boundingBox: BoundingBox
  confidence: number
  landmarks?: FaceLandmarks[]
  imageQuality: ImageQualityMetrics
}

export interface BoundingBox {
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

export interface ImageQualityResult {
  isValid: boolean
  issues: string[]
  metrics: ImageQualityMetrics
}

export interface ImageQualityMetrics {
  sharpness: number
  brightness: number
  contrast: number
  sizeBytes: number
  width: number
  height: number
  format: string
  hasAlpha: boolean
}

export interface PrepareOptions {
  targetWidth: number
  targetHeight: number
  quality: number
  format: 'jpeg' | 'png'
  normalize: boolean
  removeMetadata: boolean
  maxSizeKB: number
}

export interface ProviderProfile {
  name: string
  version: string
  supportedResolutions: { width: number; height: number }[]
  maxImageSizeKB: number
  defaultQuality: number
  supportedFormats: string[]
}

export interface BiometricProvider {
  readonly profile: ProviderProfile
  readonly name: string
  readonly version: string

  detectFaces(buffer: Buffer): Promise<FaceDetectionResult[]>
  validateQuality(buffer: Buffer): Promise<ImageQualityResult>
  prepareImage(buffer: Buffer, options: PrepareOptions): Promise<Buffer>
  getPreparationProfile(): ProviderProfile
  dispose(): Promise<void>
}

export interface WorkerTask {
  id: string
  type: 'detect' | 'validate' | 'prepare'
  payload: Buffer
  options?: PrepareOptions
  timeout: number
  createdAt: number
}

export interface WorkerResult<T = unknown> {
  taskId: string
  success: boolean
  result?: T
  error?: string
  durationMs: number
}

export interface PoolMetrics {
  activeWorkers: number
  idleWorkers: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  timeoutTasks: number
  avgProcessingTimeMs: number
  avgMemoryUsageMB: number
  queueSize: number
}

export const DEFAULT_PREPARE_OPTIONS: PrepareOptions = {
  targetWidth: 500,
  targetHeight: 500,
  quality: 85,
  format: 'jpeg',
  normalize: true,
  removeMetadata: true,
  maxSizeKB: 200
}
