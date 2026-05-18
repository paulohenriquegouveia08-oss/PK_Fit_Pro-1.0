import { logger } from '../core/logger';

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

interface QueuedTask {
    fn: () => Promise<unknown>;
    id: string;
    priority: number;
}

class SimpleQueue {
    private queue: QueuedTask[] = [];
    private running = 0;
    private readonly concurrency: number;

    constructor(concurrency: number = 2) {
        this.concurrency = concurrency;
    }

    add(fn: () => Promise<unknown>, options?: { priority?: number; id?: string }): Promise<unknown> {
        const id = options?.id || `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        return new Promise((resolve, reject) => {
            const task: QueuedTask = {
                fn: async () => {
                    try {
                        const result = await fn();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                },
                id,
                priority: options?.priority ?? 0
            };

            this.queue.push(task);
            this.queue.sort((a, b) => b.priority - a.priority);
            
            logger.debug('Task added to queue', { taskId: id, queueSize: this.queue.length });
            
            this.process();
        });
    }

    private async process(): Promise<void> {
        if (this.running >= this.concurrency) {
            return;
        }

        const task = this.queue.shift();
        if (!task) {
            return;
        }

        this.running++;
        logger.debug('Processing task', { taskId: task.id, running: this.running });

        try {
            await task.fn();
            logger.debug('Task completed', { taskId: task.id });
        } catch (error) {
            logger.error('Task failed', { taskId: task.id, error });
        } finally {
            this.running--;
            this.process();
        }
    }

    get size(): number {
        return this.queue.length;
    }

    get pending(): number {
        return this.running;
    }
}

export const faceSyncQueue = new SimpleQueue(2);

export function addToFaceQueue<T>(
    taskFn: () => Promise<T>,
    options?: { priority?: number; id?: string }
): Promise<T> {
    return faceSyncQueue.add(taskFn, options) as Promise<T>;
}

export function getQueueStats(): QueueStats {
    return {
        pending: faceSyncQueue.size,
        running: faceSyncQueue.pending,
        completed: 0,
        failed: 0
    };
}