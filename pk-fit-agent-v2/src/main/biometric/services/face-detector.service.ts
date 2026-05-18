import { WorkerPool } from '../workers/worker-pool'
import { logger } from '../../core/logger'
import type {
  FaceDetectionResult,
  ImageQualityResult,
  PrepareOptions,
  ProviderProfile,
  PoolMetrics
} from '../interfaces/biometric-provider.interface'
import { DEFAULT_PREPARE_OPTIONS } from '../interfaces/biometric-provider.interface'

export class FaceDetectorService {
  private workerPool: WorkerPool
  private disposed = false
  private metrics: ServiceMetrics = {
    totalDetections: 0,
    successfulDetections: 0,
    failedDetections: 0,
    totalValidations: 0,
    successfulValidations: 0,
    failedValidations: 0,
    avgDetectionTimeMs: 0,
    avgValidationTimeMs: 0,
    avgPrepTimeMs: 0,
    startTime: Date.now()
  }

  constructor(options: ServiceOptions = {}) {
    this.workerPool = new WorkerPool(
      options.maxWorkers || 2,
      options.taskTimeout || 30000,
      options.maxTasksPerWorker || 100
    )

    logger.info('FaceDetectorService initialized', {
      maxWorkers: options.maxWorkers || 2,
      taskTimeout: options.taskTimeout || 30000,
      maxTasksPerWorker: options.maxTasksPerWorker || 100
    })
  }

  async detectFaces(buffer: Buffer): Promise<FaceDetectionResult[]> {
    if (this.disposed) {
      throw new Error('FaceDetectorService is disposed')
    }

    const startTime = Date.now()

    try {
      const results = await this.workerPool.execute<FaceDetectionResult[]>('detect', buffer)

      this.metrics.totalDetections++
      this.metrics.successfulDetections++
      this.updateAvgDetectionTime(Date.now() - startTime)

      return results
    } catch (error) {
      this.metrics.totalDetections++
      this.metrics.failedDetections++

      logger.error('Face detection failed', {
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      })

      throw error
    }
  }

  async validateQuality(buffer: Buffer): Promise<ImageQualityResult> {
    if (this.disposed) {
      throw new Error('FaceDetectorService is disposed')
    }

    const startTime = Date.now()

    try {
      const result = await this.workerPool.execute<ImageQualityResult>('validate', buffer)

      this.metrics.totalValidations++
      if (result.isValid) {
        this.metrics.successfulValidations++
      } else {
        this.metrics.failedValidations++
      }
      this.updateAvgValidationTime(Date.now() - startTime)

      return result
    } catch (error) {
      this.metrics.totalValidations++
      this.metrics.failedValidations++

      logger.error('Quality validation failed', {
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      })

      throw error
    }
  }

  async prepareForHardware(
    buffer: Buffer,
    options: PrepareOptions = DEFAULT_PREPARE_OPTIONS
  ): Promise<Buffer> {
    if (this.disposed) {
      throw new Error('FaceDetectorService is disposed')
    }

    const startTime = Date.now()

    try {
      // Validar qualidade primeiro
      const quality = await this.validateQuality(buffer)

      if (!quality.isValid) {
        logger.warn('Image quality issues detected', { issues: quality.issues })
      }

      // Preparar imagem via worker
      const prepared = await this.workerPool.execute<Buffer>('prepare', buffer, options)

      this.updateAvgPrepTime(Date.now() - startTime)

      logger.debug('Image prepared for hardware', {
        originalSize: buffer.length,
        preparedSize: prepared.length,
        durationMs: Date.now() - startTime
      })

      return prepared
    } catch (error) {
      logger.error('Image preparation failed', {
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      })

      throw error
    }
  }

  getPreparationProfile(): ProviderProfile {
    return {
      name: 'sharp-fallback',
      version: '1.0.0',
      supportedResolutions: [
        { width: 500, height: 500 },
        { width: 800, height: 800 },
        { width: 1024, height: 1024 }
      ],
      maxImageSizeKB: 500,
      defaultQuality: 85,
      supportedFormats: ['jpeg', 'png']
    }
  }

  getPoolMetrics(): PoolMetrics {
    return this.workerPool.getMetrics()
  }

  getServiceMetrics(): ServiceMetrics {
    return {
      ...this.metrics,
      uptimeSeconds: Math.floor((Date.now() - this.metrics.startTime) / 1000)
    }
  }

  private updateAvgDetectionTime(timeMs: number): void {
    const total = this.metrics.successfulDetections
    this.metrics.avgDetectionTimeMs = Math.round(
      (this.metrics.avgDetectionTimeMs * (total - 1) + timeMs) / total
    )
  }

  private updateAvgValidationTime(timeMs: number): void {
    const total = this.metrics.totalValidations
    this.metrics.avgValidationTimeMs = Math.round(
      (this.metrics.avgValidationTimeMs * (total - 1) + timeMs) / total
    )
  }

  private updateAvgPrepTime(timeMs: number): void {
    const total = this.metrics.successfulDetections + this.metrics.successfulValidations
    if (total > 0) {
      this.metrics.avgPrepTimeMs = Math.round(
        (this.metrics.avgPrepTimeMs * (total - 1) + timeMs) / total
      )
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return

    this.disposed = true
    await this.workerPool.shutdown()

    logger.info('FaceDetectorService disposed', this.getServiceMetrics())
  }
}

interface ServiceOptions {
  maxWorkers?: number
  taskTimeout?: number
  maxTasksPerWorker?: number
}

interface ServiceMetrics {
  totalDetections: number
  successfulDetections: number
  failedDetections: number
  totalValidations: number
  successfulValidations: number
  failedValidations: number
  avgDetectionTimeMs: number
  avgValidationTimeMs: number
  avgPrepTimeMs: number
  startTime: number
  uptimeSeconds?: number
}
