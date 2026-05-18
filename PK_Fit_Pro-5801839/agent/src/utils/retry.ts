import { logger } from '../config/logger';

export interface RetryOptions {
    retries?: number;
    delay?: number;
    backoffMultiplier?: number;
    onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    retries: 3,
    delay: 1000,
    backoffMultiplier: 2,
    onRetry: undefined
};

export async function retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt <= opts.retries) {
                const delay = opts.delay * Math.pow(opts.backoffMultiplier, attempt - 1);

                logger.warn({
                    attempt,
                    maxRetries: opts.retries,
                    delay,
                    error: lastError.message,
                    stack: lastError.stack
                }, 'Retrying after failure');

                if (opts.onRetry) {
                    opts.onRetry(lastError, attempt);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError!;
}

export class RetryableError extends Error {
    constructor(message: string, public readonly code?: string) {
        super(message);
        this.name = 'RetryableError';
    }
}

export function isRetryableError(error: unknown): boolean {
    if (error instanceof RetryableError) {
        return true;
    }

    if (error instanceof Error) {
        const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET'];
        const message = error.message.toLowerCase();
        
        return retryableCodes.some(code => message.includes(code.toLowerCase()));
    }

    return false;
}