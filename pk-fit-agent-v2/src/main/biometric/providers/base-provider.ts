import type {
  BiometricProvider,
  FaceDetectionResult,
  ImageQualityResult,
  PrepareOptions,
  ProviderProfile
} from '../interfaces/biometric-provider.interface'
import { DEFAULT_PREPARE_OPTIONS } from '../interfaces/biometric-provider.interface'
import { logger } from '../../core/logger'

export abstract class BaseProvider implements BiometricProvider {
  abstract readonly name: string
  abstract readonly version: string

  abstract detectFaces(buffer: Buffer): Promise<FaceDetectionResult[]>
  abstract validateQuality(buffer: Buffer): Promise<ImageQualityResult>
  abstract prepareImage(buffer: Buffer, options: PrepareOptions): Promise<Buffer>
  abstract dispose(): Promise<void>

  get profile(): ProviderProfile {
    return {
      name: this.name,
      version: this.version,
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

  getPreparationProfile(): ProviderProfile {
    return this.profile
  }

  protected log(method: string, data?: Record<string, unknown>): void {
    logger.debug(`[${this.name}] ${method}`, data)
  }

  protected logError(method: string, error: Error | string): void {
    logger.error(`[${this.name}] ${method} failed`, { error: error instanceof Error ? error.message : error })
  }
}

export class SharpImagePreparator {
  async prepare(buffer: Buffer, options: PrepareOptions = DEFAULT_PREPARE_OPTIONS): Promise<Buffer> {
    const sharp = await import('sharp')
    
    let image = sharp.default(buffer)
    
    // Redimensionar
    image = image.resize(options.targetWidth, options.targetHeight, {
      fit: 'cover',
      position: 'center'
    })

    // Formato
    if (options.format === 'jpeg') {
      image = image.jpeg({ quality: options.quality })
    } else if (options.format === 'png') {
      image = image.png()
    }

    // Remover metadados (EXIF)
    if (options.removeMetadata) {
      image = image.rotate()
    }

    // Normalizar
    if (options.normalize) {
      image = image.normalise()
    }

    // Limitar tamanho
    let result = await image.toBuffer()
    
    if (options.maxSizeKB && result.length > options.maxSizeKB * 1024) {
      let quality = options.quality
      while (result.length > options.maxSizeKB * 1024 && quality > 10) {
        quality -= 5
        image = sharp.default(buffer)
          .resize(options.targetWidth, options.targetHeight, { fit: 'cover', position: 'center' })
          .jpeg({ quality })
          .rotate()
          .normalise()
        result = await image.toBuffer()
      }
    }

    return result
  }

  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const sharp = await import('sharp')
    const metadata = await sharp.default(buffer).metadata()
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      hasAlpha: metadata.hasAlpha || false,
      sizeBytes: buffer.length
    }
  }
}

export interface ImageMetadata {
  width: number
  height: number
  format: string
  hasAlpha: boolean
  sizeBytes: number
}