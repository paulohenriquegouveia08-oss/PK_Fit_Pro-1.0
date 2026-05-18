import express, { Request, Response, NextFunction, Application } from 'express'
import cors from 'cors'
import { emulatorManager } from '../core/emulator-manager.js'
import { eventBus } from '../core/event-bus.js'
import { simulateLatency } from '../network/latency-simulator.js'
import { ChaosMode } from '../network/chaos-mode.js'
import type { FacePayload, DeviceConfig } from '../types/emulator.types.js'
import type { Socket } from 'net'

import { faceEngine } from '../../biometric/face-engine.js'
import { eventEngine } from '../../events/event-engine.js'

const chaosMode = new ChaosMode()
const users = new Map<number, any>()

export class EmulatorServer {
  private app = express()
  private server: ReturnType<typeof this.app.listen> | null = null
  private connections = new Set<Socket>()

  constructor() {
    this.setupMiddleware()
    this.registerRoutes()
  }

  private setupMiddleware(): void {
    this.app.use(cors())
    this.app.use(express.json({ limit: '50mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }))

    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      const start = Date.now()

      _res.on('finish', () => {
        const latency = Date.now() - start
        const success = _res.statusCode >= 200 && _res.statusCode < 400
        emulatorManager.recordRequest(success, latency)
      })

      next()
    })

    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      const sim = emulatorManager.getNetworkSimulation()

      if (sim.enabled && sim.chaosMode && ChaosMode.shouldFail(sim.chaosFailureRate)) {
        return _res.status(500).json({ error: 'Chaos mode: simulated failure' })
      }

      if (sim.enabled && sim.latencyMs > 0) {
        setTimeout(next, sim.latencyMs)
      } else {
        next()
      }
    })
  }

  private registerRoutes(): void {
    this.app.get('/health', async (req: Request, res: Response) => {
      return res.json({
        online: true,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: Date.now()
      })
    })

    this.app.get('/metrics', async (req: Request, res: Response) => {
      return res.json({
        devices: 1,
        users: users.size,
        faces: faceEngine.getFacesCount(),
        events: eventEngine.getEvents().length
      })
    })

    this.app.get('/devices', async (_req: Request, res: Response) => {
      const configs = emulatorManager.getConfigs()
      const statuses = await Promise.all(configs.map(async (config: DeviceConfig) => {
        const device = emulatorManager.get(config.id)
        return {
          ...config,
          status: device ? await device.getStatus() : undefined
        }
      }))
      res.json(statuses)
    })

    this.app.post('/network-simulation', (req: Request, res: Response) => {
      const { enabled, latencyMs, packetLossRate, chaosMode: chaos, chaosFailureRate } = req.body
      emulatorManager.setNetworkSimulation({
        enabled: enabled ?? false,
        latencyMs: latencyMs ?? 0,
        packetLossRate: packetLossRate ?? 0,
        chaosMode: chaos ?? false,
        chaosFailureRate: chaosFailureRate ?? 0.1
      })
      res.json({ success: true, config: emulatorManager.getNetworkSimulation() })
    })

    this.app.get('/events', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const listener = (event: unknown) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }

      eventBus.onEvent(listener as (event: unknown) => void)

      res.on('close', () => {
        eventBus.removeEventListener(listener as (event: unknown) => void)
      })
    })

    this.app.all('/get_catra_info.fcgi', async (req: Request, res: Response) => {
      return res.json({
        device_name: 'Control iD Emulator',
        serial_number: 'EMU-CTRLID-001',
        firmware_version: '1.0.0',
        online: true,
        model: 'IDBlock Next',
        uptime: process.uptime(),
        clockwise: 0,
        anticlockwise: 0,
        total: 0
      })
    })

    this.app.post('/execute_actions.fcgi', async (req: Request, res: Response) => {
      const body = req.body
      console.log('Action request:', body)

      // Se houver uma ação de catraca, simulamos no eventBus
      if (body?.actions?.[0]?.action === 'catra') {
        const allow = body.actions[0].parameters?.allow
        if (allow === 'clockwise' || allow === 'anticlockwise') {
          eventBus.emitGateOpened('controlid-1', 'Control iD')
        }
      }

      return res.json({
        success: true,
        action: body,
        executed_at: new Date().toISOString()
      })
    })

    this.app.post('/create_objects.fcgi', async (req: Request, res: Response) => {
      const body = req.body
      if (body.object === 'users' && body.values && body.values.length > 0) {
        body.values.forEach((user: any) => {
          users.set(user.id, user)
        })
      }
      return res.json({
        success: true,
        created: true
      })
    })

    this.app.post('/destroy_objects.fcgi', async (req: Request, res: Response) => {
      const body = req.body
      if (body.object === 'users' && body.where?.users?.id) {
        users.delete(body.where.users.id)
      }
      return res.json({
        success: true,
        removed: true
      })
    })

    this.app.post('/set_user_face.fcgi', async (req: Request, res: Response) => {
      const body = req.body

      if (!body.user_id || !body.face_image) {
        return res.status(400).json({
          error: 'Invalid payload'
        })
      }

      faceEngine.saveFace(body.user_id, body.face_image)

      return res.json({
        success: true,
        biometric_saved: true
      })
    })

    this.app.post('/load_objects.fcgi', async (req: Request, res: Response) => {
      return res.json({
        access_logs: eventEngine.getEvents()
      })
    })

    this.app.post('/simulate-face-access', async (req: Request, res: Response) => {
      const { user_id, image } = req.body

      const matched = faceEngine.compare(user_id, image)

      if (matched) {
        eventEngine.addAccessGranted(user_id)
        eventBus.emitAccessGranted('controlid-1', 'Control iD', String(user_id))

        return res.json({
          success: true,
          access: 'granted'
        })
      }

      eventEngine.addAccessDenied(user_id)
      eventBus.emitAccessDenied('controlid-1', 'Control iD', String(user_id), 'Biometria inválida')

      return res.json({
        success: false,
        access: 'denied'
      })
    })

    this.app.get('/device_is_alive.fcgi', async (req: Request, res: Response) => {
      const device_id = req.query.device_id as string
      const device = emulatorManager.get(device_id || 'controlid-1')

      if (!device) {
        return res.status(404).json({ online: false, message: 'Device not found' })
      }

      try {
        const alive = await device.healthCheck()
        return res.json({ online: alive })
      } catch {
        return res.json({ online: false })
      }
    })

    this.app.get('/get_status.fcgi', async (req: Request, res: Response) => {
      const device_id = req.query.device_id as string
      const device = emulatorManager.get(device_id || 'controlid-1')

      if (!device) {
        return res.status(404).json({ status: 'unknown' })
      }

      try {
        const status = await device.getStatus()
        return res.json(status)
      } catch {
        return res.json({ status: 'error' })
      }
    })

    this.app.post('/deny_access.fcgi', async (req: Request, res: Response) => {
      const { user_id, reason, device_id } = req.body

      const device = emulatorManager.get(device_id || 'controlid-1')

      if (!device) {
        return res.status(404).json({ success: false })
      }

      try {
        const result = await device.denyAccess(user_id, reason || 'Access denied')
        return res.json(result)
      } catch {
        return res.status(500).json({ success: false })
      }
    })

    this.app.post('/simulate/timeout', async (req: Request, res: Response) => {
      await new Promise(resolve => setTimeout(resolve, 10000))
      return res.json({ success: true })
    })

    let online = true
    this.app.post('/simulate/offline', async (req: Request, res: Response) => {
      online = false
      return res.json({ success: true })
    })
  }

  async start(port: number = 8080, ip: string = '0.0.0.0'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, ip, () => {
        emulatorManager.setPort(port)
        console.log(`[EmulatorServer] Running on ${ip}:${port}`)
        resolve()
      })

      this.server.on('connection', (socket) => {
        this.connections.add(socket)
        socket.on('close', () => this.connections.delete(socket))
      })

      this.server.on('error', (error) => {
        console.error('[EmulatorServer] Failed to start', error)
        reject(error)
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        for (const socket of this.connections) {
          socket.destroy()
        }
        this.connections.clear()

        this.server.close(() => {
          console.log('[EmulatorServer] Stopped')
          this.server = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }
}