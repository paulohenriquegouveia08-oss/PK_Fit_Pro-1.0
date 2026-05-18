import fs from 'fs'
import fsAsync from 'fs/promises'
import path from 'path'
import { logger } from '../core/logger'
import type { QueueItem, QueueStatus } from '../types/biometric.types'
import { v4 as uuidv4 } from 'uuid'

const DB_FILE = 'face-sync-queue.json'
const DB_FILE_TMP = 'face-sync-queue.tmp'
const MAX_ITEMS = 2000
const MAX_COMPLETED_ITEMS = 500
const MAX_QUEUE_SIZE = 5000
const BACKPRESSURE_THRESHOLD = 4500

interface QueueData {
  items: QueueItem[]
  lastUpdated: string
}

class AsyncQueueService {
  private dbPath: string = ''
  private tmpPath: string = ''
  private data: QueueData = { items: [], lastUpdated: '' }
  private initialized: boolean = false
  private cleanupTimer: ReturnType<typeof setInterval> | null = null
  
  private writePromise: Promise<void> = Promise.resolve()

  initialize(customPath?: string): void {
    if (this.initialized) return

    try {
      this.dbPath = customPath ? path.join(customPath, DB_FILE) : path.join(process.cwd(), DB_FILE)
      this.tmpPath = path.join(path.dirname(this.dbPath), DB_FILE_TMP)

      logger.info('Initializing queue database', { path: this.dbPath })

      this.loadDataSync()
      this.restorePendingItems()
      this.scheduleCleanup()

      this.initialized = true
      logger.info('Queue initialized successfully')
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('Failed to initialize queue', { error: msg })
      throw error
    }
  }

  private loadDataSync(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const content = fs.readFileSync(this.dbPath, 'utf-8')
        const parsed = JSON.parse(content)
        
        if (parsed && Array.isArray(parsed.items)) {
          this.data = {
            items: parsed.items,
            lastUpdated: parsed.lastUpdated || new Date().toISOString()
          }
        } else {
          this.data = { items: [], lastUpdated: new Date().toISOString() }
        }
      } else {
        this.data = { items: [], lastUpdated: new Date().toISOString() }
      }
    } catch {
      logger.warn('Queue file corrupted, creating new')
      this.data = { items: [], lastUpdated: new Date().toISOString() }
    }
  }

  private async enqueueWrite(): Promise<void> {
    this.writePromise = this.writePromise
      .catch(() => undefined)
      .then(() => this.performWrite())
    
    await this.writePromise
  }

  private async performWrite(): Promise<void> {
    try {
      this.data.lastUpdated = new Date().toISOString()
      const tempData = JSON.stringify(this.data)
      
      await fsAsync.writeFile(this.tmpPath, tempData, 'utf-8')
      
      try {
        await fsAsync.rename(this.tmpPath, this.dbPath)
      } catch (renameError) {
        logger.warn('Rename failed, trying fallback copy', { error: renameError })
        await fsAsync.copyFile(this.tmpPath, this.dbPath)
        await fsAsync.unlink(this.tmpPath)
      }
    } catch (error) {
      logger.error('Failed to write queue', { error })
      try {
        await fsAsync.unlink(this.tmpPath)
      } catch {}
    }
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer) return
    
    this.cleanupTimer = setInterval(() => {
      this.cleanupInternal().catch(err => 
        logger.error('Queue cleanup failed', { error: err })
      )
    }, 1000 * 60 * 30)
  }

  private async cleanupInternal(): Promise<void> {
    if (this.data.items.length > MAX_QUEUE_SIZE) {
      logger.warn('Queue backpressure critical', { 
        size: this.data.items.length,
        max: MAX_QUEUE_SIZE 
      })
    }

    const activeItems = this.data.items.filter(
      item => item.status === 'PENDING' || 
              item.status === 'PROCESSING' ||
              (item.status === 'RETRYING' && item.attempts < item.maxAttempts)
    )

    const recentCompleted = this.data.items
      .filter(item => item.status === 'SUCCESS' || item.status === 'FAILED')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, MAX_COMPLETED_ITEMS)

    if (this.data.items.length > MAX_ITEMS || activeItems.length < this.data.items.length * 0.5) {
      this.data.items = [...activeItems, ...recentCompleted]
      await this.enqueueWrite()
      
      logger.info('Queue cleaned up', { 
        totalItems: this.data.items.length,
        activeCount: activeItems.length 
      })
    }
  }

  private restorePendingItems(): void {
    const pendingCount = this.data.items.filter(i => i.status === 'PENDING').length
    const processingCount = this.data.items.filter(i => i.status === 'PROCESSING').length

    if (pendingCount > 0 || processingCount > 0) {
      logger.info(
        'Restoring queue from session',
        { pending: pendingCount, processing: processingCount }
      )

      this.data.items = this.data.items.map(item => {
        if (item.status === 'PROCESSING') {
          return { 
            ...item, 
            status: 'PENDING' as QueueStatus, 
            updatedAt: new Date(),
            attempts: Math.min(item.attempts + 1, item.maxAttempts)
          }
        }
        return item
      })
      
      this.enqueueWrite().catch(error =>
        logger.error('Failed restoring pending items', { error })
      )
    }
  }

  enqueue(
    userId: string,
    userName: string,
    photoUrl: string | null,
    payload: Record<string, unknown> = {}
  ): string {
    if (this.data.items.length >= BACKPRESSURE_THRESHOLD) {
      logger.warn('Queue backpressure threshold reached', { 
        size: this.data.items.length,
        threshold: BACKPRESSURE_THRESHOLD 
      })
    }

    if (this.data.items.length >= MAX_QUEUE_SIZE) {
      throw new Error(`Queue limit exceeded (${MAX_QUEUE_SIZE}). System offline for too long.`)
    }

    const id = uuidv4()

    const newItem: QueueItem = {
      id,
      userId,
      userName,
      photoUrl,
      payload,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      processedAt: null
    }

    this.data.items.push(newItem)
    this.enqueueWrite()

    logger.info('Item enqueued', { id, userId, userName, queueSize: this.data.items.length })

    return id
  }

  dequeue(): QueueItem | null {
    const pendingItems = this.data.items
      .filter(item => item.status === 'PENDING' && item.attempts < item.maxAttempts)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

    if (pendingItems.length === 0) return null

    const item = pendingItems[0]
    const index = this.data.items.findIndex(i => i.id === item.id)
    
    if (index === -1) return null

    this.data.items[index].status = 'PROCESSING'
    this.data.items[index].updatedAt = new Date()
    this.enqueueWrite()

    return this.data.items[index]
  }

  markSuccess(id: string): void {
    const index = this.data.items.findIndex(item => item.id === id)
    if (index === -1) return

    this.data.items[index].status = 'SUCCESS'
    this.data.items[index].processedAt = new Date()
    this.data.items[index].updatedAt = new Date()
    this.enqueueWrite()

    logger.info('Queue item success', { id })
  }

  markFailed(id: string, error: string): void {
    const index = this.data.items.findIndex(item => item.id === id)
    if (index === -1) return

    const item = this.data.items[index]
    const newAttempts = item.attempts + 1
    const newStatus: QueueStatus = newAttempts >= item.maxAttempts ? 'FAILED' : 'RETRYING'

    this.data.items[index].status = newStatus
    this.data.items[index].attempts = newAttempts
    this.data.items[index].lastError = error
    this.data.items[index].updatedAt = new Date()
    this.enqueueWrite()

    logger.warn('Queue item failed', { id, attempts: newAttempts, status: newStatus })
  }

  retry(id: string): void {
    const index = this.data.items.findIndex(item => item.id === id && item.attempts < item.maxAttempts)
    if (index === -1) return

    this.data.items[index].status = 'PENDING'
    this.data.items[index].updatedAt = new Date()
    this.enqueueWrite()

    logger.info('Queue item retry', { id })
  }

  getStats(): { pending: number; processing: number; success: number; failed: number; retrying: number } {
    return {
      pending: this.data.items.filter(i => i.status === 'PENDING').length,
      processing: this.data.items.filter(i => i.status === 'PROCESSING').length,
      success: this.data.items.filter(i => i.status === 'SUCCESS').length,
      failed: this.data.items.filter(i => i.status === 'FAILED').length,
      retrying: this.data.items.filter(i => i.status === 'RETRYING').length
    }
  }

  getPendingItems(): QueueItem[] {
    return this.data.items
      .filter(item => item.status === 'PENDING' || item.status === 'RETRYING')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  clear(): void {
    this.data.items = []
    this.enqueueWrite()
    logger.info('Queue cleared')
  }

  async close(): Promise<void> {
    await this.writePromise
    await this.performWrite()
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    
    this.initialized = false
    logger.info('Queue closed')
  }
}

export const sqliteQueueService = new AsyncQueueService()