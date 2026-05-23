import PQueue from 'p-queue';
import { logger, createChildLogger } from '../config/logger';

export interface QueueTask {
    id: string;
    priority?: number;
    timestamp: number;
}

export interface QueueStats {
    pending: number;
    running: number;
    completed: number;
    failed: number;
}

const queueLogger = createChildLogger({ queue: 'FaceSync' });

export const faceSyncQueue = new PQueue({
    concurrency: 2,
    interval: 1000,
    intervalCap: 10
});

faceSyncQueue.on('add', () => {
    queueLogger.debug({ size: faceSyncQueue.size, pending: faceSyncQueue.pending }, 'Task added to queue');
});

faceSyncQueue.on('next', () => {
    queueLogger.debug({ size: faceSyncQueue.size, pending: faceSyncQueue.pending }, 'Task completed');
});

faceSyncQueue.on('error', (error) => {
    queueLogger.error({ error: error.message }, 'Queue error');
});

export function addToQueue<T>(
    taskFn: () => Promise<T>,
    options?: { priority?: number; id?: string }
): Promise<T> {
    const taskId = options?.id || `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    queueLogger.debug({ taskId, priority: options?.priority }, 'Adding task to queue');

    return faceSyncQueue.add(async () => {
        queueLogger.debug({ taskId }, 'Processing task');
        
        const startTime = Date.now();
        
        try {
            const result = await taskFn();
            
            const duration = Date.now() - startTime;
            queueLogger.info({ taskId, duration }, 'Task completed successfully');
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            queueLogger.error({ taskId, duration, error: errorMessage }, 'Task failed');
            throw error;
        }
    }, { priority: options?.priority ?? 0 });
}

export function getQueueStats(): QueueStats {
    return {
        pending: faceSyncQueue.size,
        running: faceSyncQueue.pending,
        completed: faceSyncQueue.size - faceSyncQueue.pending,
        failed: 0
    };
}

export async function clearQueue(): Promise<void> {
    queueLogger.info('Clearing queue');
    faceSyncQueue.clear();
}

export async function pauseQueue(): Promise<void> {
    queueLogger.info('Pausing queue');
    await faceSyncQueue.pause();
}

export async function startQueue(): Promise<void> {
    queueLogger.info('Starting queue');
    await faceSyncQueue.start();
}

export function isQueuePaused(): boolean {
    return faceSyncQueue.paused;
}

export function getQueueSize(): number {
    return faceSyncQueue.size + faceSyncQueue.pending;
}