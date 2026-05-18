import { Worker } from 'worker_threads'
import path from 'path'
import { logger } from '../../core/logger'
import type {
  WorkerTask,
  WorkerResult,
  PoolMetrics
} from '../interfaces/biometric-provider.interface'

interface WorkerInfo {
  id: number
  worker: Worker
  busy: boolean
  tasksCompleted: number
  tasksFailed: number
  lastError?: string
  createdAt: number
}

const WORKER_SCRIPT = path.join(__dirname, 'face-detection.worker.js')

export class WorkerPool {
  private workers: Map<number, WorkerInfo> = new Map()
  private taskQueue: Map<
    string,
    {
      task: WorkerTask
      resolve: (value: unknown) => void
      reject: (reason?: unknown) => void
      timeout: ReturnType<typeof setTimeout>
    }
  > = new Map()
  private nextWorkerId = 1
  private disposed = false

  private readonly maxWorkers: number
  private readonly taskTimeout: number
  private readonly maxTasksPerWorker: number

  // Métricas
  private totalTasks = 0
  private completedTasks = 0
  private failedTasks = 0
  private timeoutTasks = 0
  private processingTimes: number[] = []

  constructor(
    maxWorkers: number = 2,
    taskTimeout: number = 30000,
    maxTasksPerWorker: number = 100
  ) {
    this.maxWorkers = maxWorkers
    this.taskTimeout = taskTimeout
    this.maxTasksPerWorker = maxTasksPerWorker

    this.initializeWorkers()
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.spawnWorker()
    }
    logger.info('Worker pool initialized', { workers: this.maxWorkers, timeout: this.taskTimeout })
  }

  private spawnWorker(): void {
    if (this.disposed) return

    const workerId = this.nextWorkerId++

    try {
      const worker = new Worker(WORKER_SCRIPT)

      worker.on('message', (result: WorkerResult) => {
        this.handleWorkerMessage(workerId, result)
      })

      worker.on('error', (error) => {
        logger.error('Worker error', { workerId, error: error.message })
        this.handleWorkerCrash(workerId)
      })

      worker.on('exit', (code) => {
        if (code !== 0) {
          logger.warn('Worker exited', { workerId, code })
          this.handleWorkerCrash(workerId)
        }
      })

      this.workers.set(workerId, {
        id: workerId,
        worker,
        busy: false,
        tasksCompleted: 0,
        tasksFailed: 0,
        createdAt: Date.now()
      })

      logger.debug('Worker spawned', { workerId })
    } catch (error) {
      logger.error('Failed to spawn worker', { workerId, error })
    }
  }

  private handleWorkerMessage(workerId: number, result: WorkerResult): void {
    const pending = this.taskQueue.get(result.taskId)
    if (!pending) return

    clearTimeout(pending.timeout)

    const duration = result.durationMs || Date.now() - pending.task.createdAt
    this.processingTimes.push(duration)

    // Manter apenas últimos 100 tempos
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift()
    }

    if (result.success) {
      this.completedTasks++
      const worker = this.workers.get(workerId)
      if (worker) {
        worker.busy = false
        worker.tasksCompleted++
      }
      pending.resolve(result.result)
    } else {
      this.failedTasks++
      const worker = this.workers.get(workerId)
      if (worker) {
        worker.busy = false
        worker.tasksFailed++
        worker.lastError = result.error
      }
      pending.reject(new Error(result.error))
    }

    this.taskQueue.delete(result.taskId)
  }

  private handleWorkerCrash(workerId: number): void {
    const worker = this.workers.get(workerId)
    if (!worker) return

    // Cancelar tarefas pendentes deste worker
    for (const [taskId, pending] of this.taskQueue) {
      this.timeoutTasks++
      pending.reject(new Error(`Worker ${workerId} crashed`))
      this.taskQueue.delete(taskId)
    }

    // Remover worker crashado
    try {
      worker.worker.terminate()
    } catch {
      // Ignored
    }
    this.workers.delete(workerId)

    // Health check - restart se não houver workers disponíveis
    if (this.getIdleWorkerCount() === 0 && !this.disposed) {
      logger.warn('No idle workers, spawning new one')
      this.spawnWorker()
    }
  }

  private getIdleWorker(): WorkerInfo | null {
    for (const worker of this.workers.values()) {
      if (!worker.busy && worker.tasksCompleted < this.maxTasksPerWorker) {
        return worker
      }
    }
    return null
  }

  private getIdleWorkerCount(): number {
    let count = 0
    for (const worker of this.workers.values()) {
      if (!worker.busy) count++
    }
    return count
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  async execute<T = unknown>(
    type: WorkerTask['type'],
    payload: Buffer,
    options?: PrepareOptions
  ): Promise<T> {
    if (this.disposed) {
      throw new Error('Worker pool is disposed')
    }

    const taskId = this.generateTaskId()
    const task: WorkerTask = {
      id: taskId,
      type,
      payload,
      options,
      timeout: this.taskTimeout,
      createdAt: Date.now()
    }

    this.totalTasks++

    // Encontrar worker idle ou criar novo
    let worker = this.getIdleWorker()

    if (!worker && this.workers.size < this.maxWorkers) {
      this.spawnWorker()
      await new Promise((resolve) => setTimeout(resolve, 100))
      worker = this.getIdleWorker()
    }

    if (!worker) {
      // Aguardar worker ficar disponível
      await new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          worker = this.getIdleWorker()
          if (worker || this.disposed) {
            clearInterval(checkInterval)
            if (this.disposed) reject(new Error('Pool disposed'))
            else resolve(undefined)
          }
        }, 100)

        setTimeout(() => {
          clearInterval(checkInterval)
          reject(new Error('Timeout waiting for worker'))
        }, 5000)
      })
    }

    if (!worker) {
      throw new Error('No workers available')
    }

    const activeWorker = worker
    activeWorker.busy = true

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.timeoutTasks++
        activeWorker.busy = false
        this.taskQueue.delete(taskId)
        reject(new Error(`Task ${taskId} timed out after ${this.taskTimeout}ms`))
      }, this.taskTimeout)

      this.taskQueue.set(taskId, {
        task,
        resolve: resolve as (value: unknown) => void,
        reject: reject as (reason?: unknown) => void,
        timeout
      })

      try {
        activeWorker.worker.postMessage(task)
      } catch (error) {
        activeWorker.busy = false
        this.taskQueue.delete(taskId)
        reject(error)
      }
    })
  }

  getMetrics(): PoolMetrics {
    const avgTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
        : 0

    return {
      activeWorkers: Array.from(this.workers.values()).filter((w) => w.busy).length,
      idleWorkers: this.getIdleWorkerCount(),
      totalTasks: this.totalTasks,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      timeoutTasks: this.timeoutTasks,
      avgProcessingTimeMs: Math.round(avgTime),
      avgMemoryUsageMB: 0,
      queueSize: this.taskQueue.size
    }
  }

  async shutdown(): Promise<void> {
    this.disposed = true

    // Cancelar tarefas pendentes
    for (const pending of this.taskQueue.values()) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Pool shutting down'))
    }
    this.taskQueue.clear()

    // Terminar workers
    for (const worker of this.workers.values()) {
      try {
        await worker.worker.terminate()
      } catch {
        // Ignored
      }
    }
    this.workers.clear()

    logger.info('Worker pool shut down', {
      totalTasks: this.totalTasks,
      completed: this.completedTasks,
      failed: this.failedTasks,
      timeouts: this.timeoutTasks
    })
  }
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
