import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' 
        ? { target: 'pino-pretty' }
        : undefined,
    formatters: {
        level: (label) => {
            return { level: label };
        }
    },
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    base: {
        service: 'pk-fit-agent'
    }
});

export function createChildLogger(context: Record<string, unknown>) {
    return logger.child(context);
}