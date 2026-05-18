import sharp from 'sharp';
import { logger } from '../config/logger';

export interface ImageProcessOptions {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
}

const DEFAULT_OPTIONS: Required<ImageProcessOptions> = {
    width: 500,
    height: 500,
    quality: 90,
    format: 'jpeg'
};

export async function processFaceImage(
    buffer: Buffer,
    options: ImageProcessOptions = {}
): Promise<Buffer> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    logger.debug({
        inputSize: buffer.length,
        width: opts.width,
        height: opts.height,
        quality: opts.quality
    }, 'Processing face image');

    try {
        const image = sharp(buffer);
        
        const metadata = await image.metadata();
        
        logger.debug({
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            channels: metadata.channels
        }, 'Image metadata');

        let processed = image.resize(opts.width, opts.height, {
            fit: 'cover',
            position: 'center'
        });

        if (opts.format === 'jpeg') {
            processed = processed.jpeg({
                quality: opts.quality,
                mozjpeg: true
            });
        } else if (opts.format === 'png') {
            processed = processed.png({
                compressionLevel: 9
            });
        } else if (opts.format === 'webp') {
            processed = processed.webp({
                quality: opts.quality
            });
        }

        const result = await processed.toBuffer();

        logger.debug({
            outputSize: result.length,
            compressionRatio: (result.length / buffer.length * 100).toFixed(2) + '%'
        }, 'Image processed successfully');

        return result;
    } catch (error) {
        logger.error({ error }, 'Failed to process image');
        throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function validateFaceImage(buffer: Buffer): Promise<boolean> {
    try {
        const metadata = await sharp(buffer).metadata();

        if (!metadata.width || !metadata.height) {
            logger.warn('Image has no dimensions');
            return false;
        }

        if (metadata.width < 100 || metadata.height < 100) {
            logger.warn({ width: metadata.width, height: metadata.height }, 'Image too small');
            return false;
        }

        if (!['jpeg', 'jpg', 'png', 'webp'].includes(metadata.format || '')) {
            logger.warn({ format: metadata.format }, 'Unsupported image format');
            return false;
        }

        const aspectRatio = metadata.width / metadata.height;
        if (aspectRatio < 0.5 || aspectRatio > 2.0) {
            logger.warn({ aspectRatio }, 'Unusual aspect ratio');
        }

        return true;
    } catch (error) {
        logger.error({ error }, 'Failed to validate image');
        return false;
    }
}

export async function detectFacePosition(buffer: Buffer): Promise<{ x: number; y: number; width: number; height: number } | null> {
    const { data, info } = await sharp(buffer)
        .resize(200, 200, { fit: 'cover' })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    let minX = 200, minY = 200, maxX = 0, maxY = 0;
    let foundPixel = false;

    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = y * info.width + x;
            if (data[idx] < 128) {
                foundPixel = true;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (!foundPixel) {
        return null;
    }

    const scale = info.width / 200;
    return {
        x: Math.floor(minX * scale),
        y: Math.floor(minY * scale),
        width: Math.floor((maxX - minX) * scale),
        height: Math.floor((maxY - minY) * scale)
    };
}

export async function convertToGrayscale(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .grayscale()
        .toBuffer();
}

export async function getImageMetadata(buffer: Buffer): Promise<sharp.Metadata> {
    return sharp(buffer).metadata();
}