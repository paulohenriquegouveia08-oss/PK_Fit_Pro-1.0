import axios, { AxiosError } from 'axios';
import { logger } from '../config/logger';
import { RetryableError, isRetryableError } from './retry';

export interface DownloadImageOptions {
    timeout?: number;
    retries?: number;
}

const DEFAULT_OPTIONS: Required<DownloadImageOptions> = {
    timeout: 10000,
    retries: 3
};

export async function downloadImage(
    url: string,
    options: DownloadImageOptions = {}
): Promise<Buffer> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    logger.debug({ url, timeout: opts.timeout }, 'Downloading image');

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: opts.timeout,
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400
        });

        if (!response.data || response.data.length === 0) {
            throw new RetryableError('Empty response from image URL', 'EMPTY_RESPONSE');
        }

        const buffer = Buffer.from(response.data);
        
        logger.debug({
            url,
            size: buffer.length,
            contentType: response.headers['content-type']
        }, 'Image downloaded successfully');

        return buffer;
    } catch (error) {
        if (error instanceof AxiosError) {
            if (error.code === 'ECONNABORTED') {
                throw new RetryableError(`Timeout downloading image: ${url}`, 'TIMEOUT');
            }
            if (error.code === 'ENOTFOUND') {
                throw new RetryableError(`Image URL not found: ${url}`, 'NOT_FOUND');
            }
            if (error.response) {
                throw new RetryableError(
                    `Failed to download image: HTTP ${error.response.status}`,
                    `HTTP_${error.response.status}`
                );
            }
        }

        if (isRetryableError(error)) {
            throw error;
        }

        throw new RetryableError(`Failed to download image: ${url}`, 'DOWNLOAD_ERROR');
    }
}

export async function downloadImageWithSignedUrl(
    supabaseUrl: string,
    supabaseKey: string,
    bucket: string,
    path: string,
    expiresIn: number = 300
): Promise<Buffer> {
    const signedUrl = await getSignedUrl(supabaseUrl, supabaseKey, bucket, path, expiresIn);
    return downloadImage(signedUrl);
}

async function getSignedUrl(
    supabaseUrl: string,
    supabaseKey: string,
    bucket: string,
    path: string,
    expiresIn: number
): Promise<string> {
    const response = await axios.post(
        `${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`,
        { expiresIn },
        {
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.data?.signedURL) {
        throw new Error('Failed to get signed URL');
    }

    return `${supabaseUrl}/storage/v1${response.data.signedURL}`;
}