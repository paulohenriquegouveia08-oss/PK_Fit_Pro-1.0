import { logger } from '../core/logger'
import { RetryableError, isRetryableError } from './retry'

export interface DownloadImageOptions {
  timeout?: number
}

const DEFAULT_OPTIONS: Required<DownloadImageOptions> = {
  timeout: 10000
}

export async function downloadImage(
  url: string,
  options: DownloadImageOptions = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  logger.debug('Downloading image', { url, timeout: opts.timeout })

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(opts.timeout)
    })

    if (!response.ok) {
      throw new RetryableError(
        `HTTP ${response.status}: ${response.statusText}`,
        `HTTP_${response.status}`
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (!buffer || buffer.length === 0) {
      throw new RetryableError('Empty response from image URL', 'EMPTY_RESPONSE')
    }

    logger.debug('Image downloaded successfully', {
      url,
      size: buffer.length,
      contentType: response.headers.get('content-type')
    })

    return buffer
  } catch (error) {
    if (error instanceof RetryableError) {
      throw error
    }

    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        throw new RetryableError(`Timeout downloading image: ${url}`, 'TIMEOUT')
      }
    }

    if (isRetryableError(error)) {
      throw error
    }

    throw new RetryableError(`Failed to download image: ${url}`, 'DOWNLOAD_ERROR')
  }
}

export async function getSignedUrl(
  supabaseUrl: string,
  supabaseKey: string,
  bucket: string,
  path: string,
  expiresIn: number = 300
): Promise<string> {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn })
  })

  if (!response.ok) {
    throw new Error(`Failed to get signed URL: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.signedURL) {
    throw new Error('Failed to get signed URL - no URL returned')
  }

  return `${supabaseUrl}/storage/v1${data.signedURL}`
}

export async function downloadImageWithSignedUrl(
  supabaseUrl: string,
  supabaseKey: string,
  bucket: string,
  path: string,
  expiresIn: number = 300
): Promise<Buffer> {
  const signedUrl = await getSignedUrl(supabaseUrl, supabaseKey, bucket, path, expiresIn)
  return downloadImage(signedUrl)
}
