export const COMMAND_TYPES = {
    GRANT_ACCESS: 'GRANT_ACCESS',
    DENY_ACCESS: 'DENY_ACCESS',
    SYNC_USERS: 'SYNC_USERS',
    SYNC_FACE: 'SYNC_FACE',
    REBOOT: 'REBOOT'
} as const;

export const SYNC_STATUS = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    RETRYING: 'RETRYING'
} as const;

export const IMAGE_CONFIG = {
    DEFAULT_WIDTH: 500,
    DEFAULT_HEIGHT: 500,
    DEFAULT_QUALITY: 90,
    MIN_WIDTH: 100,
    MIN_HEIGHT: 100,
    SUPPORTED_FORMATS: ['jpeg', 'jpg', 'png', 'webp']
} as const;

export const ADAPTER_DEFAULTS = {
    TIMEOUT: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    SESSION_EXPIRY_MINUTES: 25
} as const;

export const QUEUE_CONFIG = {
    CONCURRENCY: 2,
    INTERVAL: 1000,
    INTERVAL_CAP: 10
} as const;