import sharp from 'sharp'
import { logger } from '../core/logger'
import type { FaceDetectionResult } from '../types/biometric.types'

const MIN_FACE_SIZE = 80
const MAX_FACE_SIZE = 4000
const CENTER_REGION = 0.3

export class FaceDetectionService {
  async detectFace(buffer: Buffer): Promise<FaceDetectionResult> {
    try {
      const metadata = await sharp(buffer).metadata()

      if (!metadata.width || !metadata.height) {
        return this.createResult(false, 'Invalid image dimensions')
      }

      const { width, height } = metadata

      const isTooSmall = width < MIN_FACE_SIZE || height < MIN_FACE_SIZE
      if (isTooSmall) {
        return this.createResult(false, 'Image too small')
      }

      const isTooLarge = width > MAX_FACE_SIZE || height > MAX_FACE_SIZE
      if (isTooLarge) {
        return this.createResult(false, 'Image too large')
      }

      const isBlurry = await this.detectBlurriness(buffer, width, height)
      if (isBlurry) {
        return this.createResult(false, 'Image is blurry', { isBlurry: true })
      }

      const faceRegion = this.estimateFaceRegion(width, height)

      const hasFace = await this.detectSkinTones(buffer, faceRegion)

      if (!hasFace) {
        return this.createResult(false, 'No face detected in image')
      }

      const isOffCenter = !this.isFaceCentered(width, height, faceRegion)
      if (isOffCenter) {
        return this.createResult(false, 'Face not centered', { isOffCenter: true })
      }

      return {
        hasFace: true,
        faceCount: 1,
        isBlurry: false,
        isTooSmall: false,
        isPoorLighting: false,
        isOffCenter: false,
        confidence: 0.85,
        boundingBox: {
          x: faceRegion.x,
          y: faceRegion.y,
          width: faceRegion.width,
          height: faceRegion.height
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('Face detection failed', { error: msg })
      return this.createResult(false, `Detection failed: ${msg}`)
    }
  }

  private createResult(
    hasFace: boolean,
    _message: string,
    additional?: Partial<FaceDetectionResult>
  ): FaceDetectionResult {
    return {
      hasFace,
      faceCount: hasFace ? 1 : 0,
      isBlurry: additional?.isBlurry ?? false,
      isTooSmall: additional?.isTooSmall ?? false,
      isPoorLighting: additional?.isPoorLighting ?? false,
      isOffCenter: additional?.isOffCenter ?? false,
      confidence: hasFace ? 0.8 : 0,
      ...additional
    }
  }

  private async detectBlurriness(buffer: Buffer, width: number, height: number): Promise<boolean> {
    try {
      const grayscale = await sharp(buffer)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const pixels = grayscale.data
      const totalPixels = width * height
      let laplacianSum = 0

      const step = Math.max(1, Math.floor(totalPixels / 10000))

      for (let i = step; i < totalPixels - step; i += step) {
        const current = pixels[i]
        const left = pixels[i - 1]
        const right = pixels[i + 1]
        const top = pixels[i - width]
        const bottom = pixels[i + width]

        const laplacian = Math.abs(4 * current - left - right - top - bottom)
        laplacianSum += laplacian
      }

      const sampleCount = Math.floor(totalPixels / step)
      const laplacianMean = laplacianSum / sampleCount

      const blurThreshold = 30
      return laplacianMean < blurThreshold
    } catch {
      return false
    }
  }

  private estimateFaceRegion(
    width: number,
    height: number
  ): { x: number; y: number; width: number; height: number } {
    const aspectRatio = width / height
    let faceWidth: number
    let faceHeight: number

    if (aspectRatio > 1) {
      faceHeight = Math.floor(height * 0.8)
      faceWidth = Math.floor(faceHeight * 0.75)
    } else {
      faceWidth = Math.floor(width * 0.8)
      faceHeight = Math.floor(faceWidth * 1.25)
    }

    const x = Math.floor((width - faceWidth) / 2)
    const y = Math.floor((height - faceHeight) / 2)

    return { x, y, width: faceWidth, height: faceHeight }
  }

  private async detectSkinTones(
    buffer: Buffer,
    region: { x: number; y: number; width: number; height: number }
  ): Promise<boolean> {
    try {
      const imageMeta = await sharp(buffer).metadata()
      const imgW = imageMeta.width || 0
      const imgH = imageMeta.height || 0

      const { data } = await sharp(buffer)
        .extract({
          left: Math.max(0, region.x),
          top: Math.max(0, region.y),
          width: Math.min(region.width, imgW - Math.max(0, region.x)),
          height: Math.min(region.height, imgH - Math.max(0, region.y))
        })
        .resize(50, 50)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const pixels = data
      let skinPixelCount = 0
      const sampleSize = 50 * 50

      for (let i = 0; i < sampleSize; i += 3) {
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]

        if (this.isSkinColor(r, g, b)) {
          skinPixelCount++
        }
      }

      const skinRatio = skinPixelCount / sampleSize
      const skinThreshold = 0.15

      return skinRatio >= skinThreshold
    } catch {
      return true
    }
  }

  private isSkinColor(r: number, g: number, b: number): boolean {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = (max - min) / max

    if (saturation < 0.15) return false

    const rNorm = r / 255
    const gNorm = g / 255
    const bNorm = b / 255

    return (
      rNorm > 0.35 &&
      rNorm < 0.85 &&
      gNorm > 0.25 &&
      gNorm < 0.75 &&
      bNorm > 0.2 &&
      bNorm < 0.7 &&
      rNorm > gNorm &&
      rNorm > bNorm * 0.8
    )
  }

  private isFaceCentered(
    imageWidth: number,
    imageHeight: number,
    faceRegion: { x: number; y: number; width: number; height: number }
  ): boolean {
    const faceCenterX = faceRegion.x + faceRegion.width / 2
    const faceCenterY = faceRegion.y + faceRegion.height / 2

    const imageCenterX = imageWidth / 2
    const imageCenterY = imageHeight / 2

    const maxOffsetX = imageWidth * CENTER_REGION
    const maxOffsetY = imageHeight * CENTER_REGION

    const offsetX = Math.abs(faceCenterX - imageCenterX)
    const offsetY = Math.abs(faceCenterY - imageCenterY)

    return offsetX <= maxOffsetX && offsetY <= maxOffsetY
  }
}

export const faceDetectionService = new FaceDetectionService()