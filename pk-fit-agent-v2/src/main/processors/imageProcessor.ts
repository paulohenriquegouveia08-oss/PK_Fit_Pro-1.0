import sharp from 'sharp'
import { logger } from '../core/logger'
import type { ProcessedImageResult } from '../types/biometric.types'

export interface ImageProcessOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

const DEFAULT_OPTIONS: Required<ImageProcessOptions> = {
  width: 500,
  height: 500,
  quality: 85,
  format: 'jpeg'
}

export async function processFaceImage(
  buffer: Buffer,
  options: ImageProcessOptions = {}
): Promise<ProcessedImageResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  logger.debug(
    'Processing face image with Sharp',
    {
      inputSize: buffer.length,
      width: opts.width,
      height: opts.height,
      quality: opts.quality,
      format: opts.format
    }
  )

  try {
    const processedBuffer = await sharp(buffer)
      .resize(opts.width, opts.height, {
        fit: 'cover',
        position: 'centre'
      })
      .removeAlpha()
      .toColorspace('srgb')
      .jpeg({
        quality: opts.quality,
        progressive: true,
        optimiseScans: true
      })
      .withMetadata({
        orientation: 1
      })
      .toBuffer()

    const metadata = await sharp(processedBuffer).metadata()

    logger.debug(
      'Image processed successfully with Sharp',
      {
        inputSize: buffer.length,
        outputSize: processedBuffer.length,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format
      }
    )

    return {
      buffer: processedBuffer,
      width: metadata.width || opts.width,
      height: metadata.height || opts.height,
      format: metadata.format || 'jpeg',
      size: processedBuffer.length
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('Failed to process image with Sharp', { error: msg, inputSize: buffer.length })
    throw new Error(`Image processing failed: ${msg}`)
  }
}

export async function validateFaceImage(buffer: Buffer): Promise<{
  valid: boolean
  error?: string
  metadata?: {
    width: number
    height: number
    format: string
    size: number
  }
}> {
  if (!buffer || buffer.length < 1000) {
    return { valid: false, error: 'Image too small (minimum 1KB)' }
  }

  if (buffer.length > 10 * 1024 * 1024) {
    return { valid: false, error: 'Image too large (maximum 10MB)' }
  }

  try {
    const metadata = await sharp(buffer).metadata()

    if (!metadata.width || !metadata.height) {
      return { valid: false, error: 'Invalid image dimensions' }
    }

    const validFormats = ['jpeg', 'png', 'webp', 'gif']
    if (!metadata.format || !validFormats.includes(metadata.format)) {
      return { valid: false, error: `Unsupported format: ${metadata.format}` }
    }

    if (metadata.width < 100 || metadata.height < 100) {
      return { valid: false, error: 'Image too small (minimum 100x100)' }
    }

    return {
      valid: true,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('Failed to validate image', { error: msg })
    return { valid: false, error: `Validation failed: ${msg}` }
  }
}

export async function getImageMetadata(buffer: Buffer): Promise<{
  width?: number
  height?: number
  format?: string
  size: number
  hasAlpha?: boolean
} | null> {
  try {
    const metadata = await sharp(buffer).metadata()

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      hasAlpha: metadata.hasAlpha
    }
  } catch (error) {
    logger.error('Failed to get image metadata', { error })
    return null
  }
}

export async function convertToJpeg(buffer: Buffer, quality: number = 85): Promise<Buffer> {
  return sharp(buffer)
    .removeAlpha()
    .jpeg({ quality })
    .toBuffer()
}

export async function resizeImage(
  buffer: Buffer,
  width: number,
  height: number,
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside' = 'cover'
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit, position: 'centre' })
    .toBuffer()
}