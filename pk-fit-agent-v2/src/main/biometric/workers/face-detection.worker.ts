import { parentPort } from 'worker_threads'
import sharp from 'sharp'
import { DEFAULT_PREPARE_OPTIONS } from '../interfaces/biometric-provider.interface'

interface WorkerMessage {
  id: string
  type: 'detect' | 'validate' | 'prepare'
  payload: Buffer
  options?: PrepareOptions
}

interface WorkerResponse {
  id: string
  success: boolean
  result?: unknown
  error?: string
  durationMs: number
}

interface PrepareOptions {
  targetWidth: number
  targetHeight: number
  quality: number
  format: 'jpeg' | 'png'
  normalize: boolean
  removeMetadata: boolean
  maxSizeKB: number
}

const DEFAULT_OPTIONS = DEFAULT_PREPARE_OPTIONS

parentPort?.on('message', async (message: WorkerMessage) => {
  const startTime = Date.now()

  try {
    let result: unknown

    switch (message.type) {
      case 'detect':
        result = await detectFaces(message.payload)
        break
      case 'validate':
        result = await validateImageQuality(message.payload)
        break
      case 'prepare':
        result = await prepareImage(message.payload, message.options || DEFAULT_OPTIONS)
        break
      default:
        throw new Error(`Unknown task type: ${message.type}`)
    }

    const response: WorkerResponse = {
      id: message.id,
      success: true,
      result,
      durationMs: Date.now() - startTime
    }

    parentPort?.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      id: message.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime
    }

    parentPort?.postMessage(response)
  }
})

async function detectFaces(buffer: Buffer): Promise<FaceDetectionResult[]> {
  const image = sharp(buffer)
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image metadata')
  }

  // Sharp não detecta faces - retorna mock com análise básica
  // Em produção, isso seria substituído por MediaPipe/BlazeFace
  const { data, info } = await image
    .resize(500, 500, { fit: 'cover' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Análise básica de imagem para detecção
  const brightness = calculateBrightness(data)
  const sharpness = calculateSharpness(data, info.width, info.height)
  const contrast = calculateContrast(data)

  // Simular detecção de face (centro da imagem)
  const centerX = metadata.width / 2
  const centerY = metadata.height / 2
  const faceSize = Math.min(metadata.width, metadata.height) * 0.4

  const result: FaceDetectionResult[] = [
    {
      boundingBox: {
        x: centerX - faceSize / 2,
        y: centerY - faceSize / 2,
        width: faceSize,
        height: faceSize
      },
      confidence: sharpness > 50 && brightness > 30 && brightness < 220 ? 0.8 : 0.3,
      imageQuality: {
        sharpness,
        brightness,
        contrast,
        sizeBytes: buffer.length,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format || 'unknown',
        hasAlpha: metadata.hasAlpha || false
      }
    }
  ]

  return result
}

async function validateImageQuality(buffer: Buffer): Promise<ImageQualityResult> {
  const image = sharp(buffer)
  const metadata = await image.metadata()

  if (!metadata.width || !metadata.height) {
    return {
      isValid: false,
      issues: ['Invalid image metadata'],
      metrics: {
        sharpness: 0,
        brightness: 0,
        contrast: 0,
        sizeBytes: buffer.length,
        width: 0,
        height: 0,
        format: 'unknown',
        hasAlpha: false
      }
    }
  }

  const { data, info } = await image
    .resize(500, 500, { fit: 'cover' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const brightness = calculateBrightness(data)
  const sharpness = calculateSharpness(data, info.width, info.height)
  const contrast = calculateContrast(data)

  const issues: string[] = []

  if (brightness < 30) issues.push('Too dark')
  if (brightness > 220) issues.push('Too bright')
  if (sharpness < 30) issues.push('Image too blurry')
  if (contrast < 20) issues.push('Low contrast')
  if (metadata.width < 100 || metadata.height < 100) issues.push('Image too small')

  return {
    isValid: issues.length === 0,
    issues,
    metrics: {
      sharpness,
      brightness,
      contrast,
      sizeBytes: buffer.length,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format || 'unknown',
      hasAlpha: metadata.hasAlpha || false
    }
  }
}

async function prepareImage(buffer: Buffer, options: PrepareOptions): Promise<Buffer> {
  let image = sharp(buffer)

  // Redimensionar se necessário
  if (options.targetWidth || options.targetHeight) {
    image = image.resize(options.targetWidth || 500, options.targetHeight || 500, {
      fit: 'cover',
      position: 'center'
    })
  }

  // Converter para formato especificado
  if (options.format === 'jpeg') {
    image = image.jpeg({ quality: options.quality })
  } else if (options.format === 'png') {
    image = image.png()
  }

  // Remover metadados
  if (options.removeMetadata) {
    image = image.rotate() // Auto-orient e remover EXIF
  }

  // Normalizar
  if (options.normalize) {
    image = image.normalise()
  }

  // Limitar tamanho
  if (options.maxSizeKB) {
    const maxBytes = options.maxSizeKB * 1024
    let result = await image.toBuffer()

    if (result.length > maxBytes) {
      let quality = options.quality
      while (result.length > maxBytes && quality > 10) {
        quality -= 10
        image = sharp(buffer)
          .resize(options.targetWidth || 500, options.targetHeight || 500, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality })
          .rotate()
          .normalise()
        result = await image.toBuffer()
      }
    }

    return result
  }

  return image.toBuffer()
}

function calculateBrightness(data: Buffer): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i]
  }
  return Math.round(sum / data.length)
}

function calculateSharpness(data: Buffer, width: number, height: number): number {
  let sum = 0
  let maxDiff = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const current = data[idx]
      const neighbors = [
        data[(y - 1) * width + x],
        data[(y + 1) * width + x],
        data[y * width + (x - 1)],
        data[y * width + (x + 1)]
      ]

      for (const neighbor of neighbors) {
        const diff = Math.abs(current - neighbor)
        maxDiff = Math.max(maxDiff, diff)
        sum += diff
      }
    }
  }

  return Math.round((sum / data.length) * 10)
}

function calculateContrast(data: Buffer): number {
  let min = 255
  let max = 0

  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i]
    if (data[i] > max) max = data[i]
  }

  return max - min
}

interface FaceDetectionResult {
  boundingBox: BoundingBox
  confidence: number
  imageQuality: ImageQualityMetrics
}

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

interface ImageQualityMetrics {
  sharpness: number
  brightness: number
  contrast: number
  sizeBytes: number
  width: number
  height: number
  format: string
  hasAlpha: boolean
}

interface ImageQualityResult {
  isValid: boolean
  issues: string[]
  metrics: ImageQualityMetrics
}
