import type { TurnstileAdapter } from '../adapters/adapter.interface'
import { downloadImage, downloadImageWithSignedUrl } from '../utils/downloadImage'
import { processFaceImage, validateFaceImage } from '../processors/imageProcessor'
import { faceDetectionService } from '../processors/faceDetector'
import { logger } from '../core/logger'
import { mappingService } from '../services/mapping.service'
import { circuitBreakerService } from '../services/circuit-breaker.service'
import { auditService } from '../services/audit.service'
import { sqliteQueueService } from '../services/sqlite-queue.service'
import type { ControlIdUser, FaceSyncResult, FaceSyncStatus } from '../types/user.types'
import type { FaceSyncInput, FaceSyncOutput } from '../types/biometric.types'
import { retry, RetryableError } from '../utils/retry'

export interface FaceSyncServiceConfig {
  supabaseUrl?: string
  supabaseKey?: string
  bucket?: string
  academyId: string
  provider?: string
}

export class FaceSyncService {
  private syncStatuses: Map<string, FaceSyncStatus> = new Map()

  constructor(
    private readonly adapter: TurnstileAdapter,
    private readonly config: FaceSyncServiceConfig
  ) {}

  getStatus(userId: string): FaceSyncStatus | undefined {
    return this.syncStatuses.get(userId)
  }

  async processSyncCommand(payload: FaceSyncInput): Promise<FaceSyncOutput> {
    const startTime = Date.now()
    const { userId, userName, photoUrl, providerUserId, academyId, provider } = payload

    await auditService.logSyncStart(userId, academyId, provider, providerUserId)

    const isAvailable = await circuitBreakerService.isAvailable(provider)

    if (!isAvailable) {
      const errorMsg = 'Circuit breaker is OPEN - request blocked'
      await circuitBreakerService.recordFailure(provider)
      await auditService.logSyncFailure(
        userId,
        academyId,
        provider,
        providerUserId,
        errorMsg,
        Date.now() - startTime
      )

      return {
        success: false,
        userId,
        providerUserId,
        message: errorMsg,
        errorCode: 'CIRCUIT_BREAKER_OPEN'
      }
    }

    try {
      if (!photoUrl) {
        throw new Error('Usuário sem foto')
      }

      let imageBuffer: Buffer

      if (this.config.supabaseUrl && this.config.supabaseKey) {
        const isSupabaseUrl = photoUrl.includes('supabase') || photoUrl.includes('storage')

        if (isSupabaseUrl) {
          const path = this.extractPathFromUrl(photoUrl)
          if (path) {
            try {
              imageBuffer = await downloadImageWithSignedUrl(
                this.config.supabaseUrl,
                this.config.supabaseKey,
                this.config.bucket || 'avatars',
                path
              )
            } catch (err) {
              logger.warn('Signed URL failed, trying direct download', { err, path })
              imageBuffer = await downloadImage(photoUrl)
            }
          } else {
            imageBuffer = await downloadImage(photoUrl)
          }
        } else {
          imageBuffer = await downloadImage(photoUrl)
        }
      } else {
        imageBuffer = await downloadImage(photoUrl)
      }

      logger.debug('Image downloaded', { userId, imageSize: imageBuffer.length })

      const validation = await validateFaceImage(imageBuffer)
      if (!validation.valid) {
        throw new RetryableError(validation.error || 'Invalid image format', 'INVALID_IMAGE_FORMAT')
      }

      const faceDetection = await faceDetectionService.detectFace(imageBuffer)
      if (!faceDetection.hasFace) {
        throw new RetryableError('No face detected in image', 'NO_FACE_DETECTED')
      }

      if (faceDetection.isBlurry) {
        throw new RetryableError('Image is too blurry', 'IMAGE_BLURRY')
      }

      logger.debug('Face detected and validated', { userId, faceDetection })

      const processedImage = await processFaceImage(imageBuffer, {
        width: 500,
        height: 500,
        quality: 85,
        format: 'jpeg'
      })

      logger.debug('Image processed with Sharp', { userId, processedSize: processedImage.size })

      if (!('syncUserFace' in this.adapter) || typeof this.adapter.syncUserFace !== 'function') {
        throw new Error('Adapter does not support face synchronization')
      }

      await retry(
        () => this.adapter.syncUserFace!(providerUserId, userName, processedImage.buffer),
        { retries: 3, delay: 1000 }
      )

      await mappingService.updateSyncedAt(userId, academyId, provider)

      await circuitBreakerService.recordSuccess(provider)

      const durationMs = Date.now() - startTime
      await auditService.logSyncSuccess(userId, academyId, provider, providerUserId, durationMs)

      this.updateStatus(userId, 'SUCCESS')

      logger.info('Face synced successfully', {
        userId,
        providerUserId,
        name: userName,
        durationMs
      })

      return {
        success: true,
        userId,
        providerUserId,
        message: 'Face synchronized successfully',
        durationMs
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isRetryable = error instanceof RetryableError

      await circuitBreakerService.recordFailure(provider)

      const durationMs = Date.now() - startTime
      await auditService.logSyncFailure(
        userId,
        academyId,
        provider,
        providerUserId,
        errorMessage,
        durationMs
      )

      const currentStatus = this.syncStatuses.get(userId)
      const attempts = currentStatus?.attempts || 0

      if (isRetryable && attempts < 3) {
        this.updateStatus(userId, 'RETRYING', errorMessage)
      } else {
        this.updateStatus(userId, 'FAILED', errorMessage)
      }

      logger.error('Face sync failed', {
        userId,
        providerUserId,
        error: errorMessage,
        isRetryable,
        attempts,
        durationMs
      })

      return {
        success: false,
        userId,
        providerUserId,
        message: errorMessage,
        errorCode: error instanceof RetryableError ? error.code : 'UNKNOWN_ERROR',
        durationMs
      }
    }
  }

  async sync(user: ControlIdUser): Promise<FaceSyncResult> {
    const userId = String(user.id)

    this.updateStatus(userId, 'PROCESSING')

    logger.info('Starting face sync', { userId, name: user.name })

    try {
      const mappingResult = await mappingService.getOrCreateProviderUserId(
        userId,
        this.config.academyId,
        this.config.provider || 'CONTROL_ID'
      )

      const result = await this.processSyncCommand({
        userId,
        userName: user.name,
        photoUrl: user.photo_url || '',
        providerUserId: mappingResult.providerUserId,
        academyId: this.config.academyId,
        provider: this.config.provider || 'CONTROL_ID'
      })

      if (result.success) {
        this.updateStatus(userId, 'SUCCESS')

        return {
          success: true,
          userId,
          message: result.message
        }
      } else {
        this.updateStatus(userId, 'FAILED', result.message)

        return {
          success: false,
          userId,
          message: result.message,
          errorCode: result.errorCode
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      this.updateStatus(userId, 'FAILED', errorMessage)

      logger.error('Face sync failed', { userId, error: errorMessage })

      return {
        success: false,
        userId,
        message: errorMessage,
        errorCode: 'UNKNOWN_ERROR'
      }
    }
  }

  async syncBatch(users: ControlIdUser[]): Promise<FaceSyncResult[]> {
    logger.info('Starting batch face sync', { count: users.length })

    const results: FaceSyncResult[] = []

    for (const user of users) {
      const result = await this.sync(user)
      results.push(result)
    }

    const successCount = results.filter((r) => r.success).length
    logger.info('Batch sync completed', {
      total: users.length,
      success: successCount,
      failed: users.length - successCount
    })

    return results
  }

  async removeFace(userId: string): Promise<void> {
    logger.info('Removing face', { userId })

    const providerUserId = await mappingService.getProviderUserId(
      userId,
      this.config.academyId,
      this.config.provider || 'CONTROL_ID'
    )

    if (!providerUserId) {
      logger.warn('No mapping found for user', { userId })
      return
    }

    if ('removeUser' in this.adapter && typeof this.adapter.removeUser === 'function') {
      try {
        await this.adapter.removeUser(providerUserId)
        await mappingService.deleteMapping(
          userId,
          this.config.academyId,
          this.config.provider || 'CONTROL_ID'
        )
      } catch (error) {
        logger.error('Failed to remove user from hardware', { error, userId, providerUserId })
      }
    }

    this.syncStatuses.delete(String(userId))
  }

  enqueueSync(userId: string, userName: string, photoUrl: string): void {
    sqliteQueueService.enqueue(userId, userName, photoUrl, {
      academyId: this.config.academyId,
      provider: this.config.provider || 'CONTROL_ID'
    })

    logger.info('Face sync enqueued', { userId, userName })
  }

  async processQueue(): Promise<void> {
    const item = sqliteQueueService.dequeue()

    if (!item) {
      return
    }

    logger.info('Processing queue item', { itemId: item.id, userId: item.userId })

    try {
      const mappingResult = await mappingService.getOrCreateProviderUserId(
        item.userId,
        this.config.academyId,
        this.config.provider || 'CONTROL_ID'
      )

      const result = await this.processSyncCommand({
        userId: item.userId,
        userName: item.userName,
        photoUrl: item.photoUrl || '',
        providerUserId: mappingResult.providerUserId,
        academyId: this.config.academyId,
        provider: this.config.provider || 'CONTROL_ID'
      })

      if (result.success) {
        sqliteQueueService.markSuccess(item.id)
      } else {
        sqliteQueueService.markFailed(item.id, result.message)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      sqliteQueueService.markFailed(item.id, errorMsg)
    }
  }

  getQueueStats(): {
    pending: number
    processing: number
    success: number
    failed: number
    retrying: number
  } {
    return sqliteQueueService.getStats()
  }

  private updateStatus(
    userId: string,
    status: FaceSyncStatus['status'],
    errorMessage?: string
  ): void {
    const current = this.syncStatuses.get(userId)

    this.syncStatuses.set(userId, {
      userId,
      status,
      errorMessage,
      attempts: current ? current.attempts + (status === 'RETRYING' ? 1 : 0) : 1,
      lastAttempt: new Date(),
      createdAt: current?.createdAt || new Date()
    })
  }

  private extractPathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url)
      const pathMatch = urlObj.pathname.match(
        /\/storage\/v1\/object\/(?:public\/)?(?:sign\/)?(?:avatars\/)?(.+)$/
      )
      if (pathMatch) {
        return pathMatch[1]
      }

      const pathParts = urlObj.pathname.split('/')
      const avatarsIndex = pathParts.indexOf('avatars')
      if (avatarsIndex !== -1) {
        return pathParts.slice(avatarsIndex + 1).join('/')
      }

      return null
    } catch {
      return null
    }
  }
}
