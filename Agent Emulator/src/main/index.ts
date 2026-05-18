import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import { EmulatorServer } from './emulator/server/express-server.js'
import { emulatorManager } from './emulator/core/emulator-manager.js'
import { createControlIdProvider } from './emulator/providers/controlid/controlid-emulator.js'
import { createHenryProvider } from './emulator/providers/henry/henry-emulator.js'
import { createTopDataProvider } from './emulator/providers/topdata/topdata-emulator.js'
import { eventBus } from './emulator/core/event-bus.js'
import type { NetworkSimulation } from './emulator/types/emulator.types.js'

let mainWindow: BrowserWindow | null = null
let emulatorServer: EmulatorServer | null = null

const DEVICES = [
  { id: 'controlid-1', brand: 'Control iD', model: 'iDFace', firmware: '3.1.7', ip: '127.0.0.1', port: 8080 },
  { id: 'henry-1', brand: 'Henry', model: 'Prisma SF', firmware: '2.4.1', ip: '127.0.0.1', port: 8081 },
  { id: 'topdata-1', brand: 'TopData', model: 'Inner', firmware: '1.8.3', ip: '127.0.0.1', port: 8082 }
]

async function createWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, 'preload.mjs')
  const htmlPath = path.join(__dirname, '../renderer/index.html')
  
  console.log('[createWindow] preloadPath:', preloadPath)
  console.log('[createWindow] htmlPath:', htmlPath)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'PK Fit Hardware Emulator',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: preloadPath
    },
    backgroundColor: '#0f172a'
  })

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[did-fail-load]', errorCode, errorDescription)
  })

  mainWindow.webContents.on('crashed', () => {
    console.error('[crashed] Renderer process crashed')
  })

  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:5173')
  } else {
    try {
      await mainWindow.loadFile(htmlPath)
      console.log('[createWindow] HTML loaded successfully')
    } catch (error) {
      console.error('[createWindow] Failed to load HTML:', error)
    }
  }
  
  mainWindow.webContents.openDevTools()

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (at ${sourceId}:${line})`)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

async function initializeDevices(): Promise<void> {
  for (const config of DEVICES) {
    let provider

    switch (config.brand) {
      case 'Control iD':
        provider = createControlIdProvider({ ...config, deviceId: config.id })
        break
      case 'Henry':
        provider = createHenryProvider({ ...config, deviceId: config.id })
        break
      case 'TopData':
        provider = createTopDataProvider({ ...config, deviceId: config.id })
        break
      default:
        continue
    }

    emulatorManager.register(config, provider)
    await provider.start()
  }
}

function setupIPC(): void {
  eventBus.onEvent((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('emulator:event', event)
    }
  })

  ipcMain.handle('emulator:start', async () => {
    try {
      await emulatorManager.startAll()
      await emulatorServer?.start()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('emulator:updateDeviceConfig', async (_event, deviceId: string, ip: string, port: number) => {
    try {
      const device = DEVICES.find(d => d.id === deviceId)
      const conf = emulatorManager.getConfigs().find(c => c.id === deviceId)
      const provider = emulatorManager.get(deviceId)
      
      if (!device || !conf) return { success: false, error: 'Device not found' }

      const oldIp = device.ip
      const oldPort = device.port

      // Update in memory
      device.ip = ip
      device.port = port
      conf.ip = ip
      conf.port = port
      if (provider) {
        provider.updateConfig(ip, port)
      }

      // If it's ControliD, we restart the Express server
      if (emulatorServer && device.id === 'controlid-1') {
        await emulatorServer.stop()
        try {
          await emulatorServer.start(port, ip)
        } catch (startError) {
          // Rollback if failed (e.g. EADDRINUSE)
          device.ip = oldIp
          device.port = oldPort
          conf.ip = oldIp
          conf.port = oldPort
          if (provider) provider.updateConfig(oldIp, oldPort)
          
          // Try to restore old server
          await emulatorServer.start(oldPort, oldIp).catch(() => {})
          
          throw startError
        }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('emulator:stop', async () => {
    try {
      await emulatorServer?.stop()
      await emulatorManager.stopAll()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  ipcMain.handle('emulator:getStatus', async () => {
    const devices = await Promise.all(emulatorManager.getConfigs().map(async config => {
      const device = emulatorManager.get(config.id)
      return { ...config, status: device ? await device.getStatus() : undefined }
    }))

    return {
      running: emulatorManager.isRunning(),
      port: emulatorManager.getPort(),
      devices,
      metrics: emulatorManager.getMetrics(),
      network: emulatorManager.getNetworkSimulation()
    }
  })

  ipcMain.handle('emulator:setNetworkSimulation', (_event, config: Partial<NetworkSimulation>) => {
    emulatorManager.setNetworkSimulation(config)
    return { success: true, config: emulatorManager.getNetworkSimulation() }
  })

  ipcMain.handle('emulator:simulateAction', async (_event, deviceId: string, action: string) => {
    const device = emulatorManager.get(deviceId)
    if (!device) {
      return { success: false, message: 'Device not found' }
    }

    switch (action) {
      case 'offline':
        device.simulateOffline()
        break
      case 'online':
        device.simulateOnline()
        break
      case 'timeout':
        device.simulateTimeout()
        break
      case 'error':
        device.simulateError()
        break
      default:
        return { success: false, message: 'Unknown action' }
    }

    return { success: true }
  })

  ipcMain.handle('emulator:openGate', async (_event, deviceId: string, userId: string) => {
    const device = emulatorManager.get(deviceId)
    if (!device) {
      return { success: false, message: 'Device not found' }
    }

    try {
      const result = await device.openGate(userId)
      return result
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
  })
}

app.whenReady().then(async () => {
  console.log('[App] Starting...')
  
  emulatorServer = new EmulatorServer()
  
  await initializeDevices()
  setupIPC()
  
  await emulatorServer.start(8080)
  console.log('[App] Server started on port 8080')
  
  await createWindow()
  console.log('[App] Window created')

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', async () => {
  await emulatorServer?.stop()
  await emulatorManager.stopAll()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await emulatorServer?.stop()
  await emulatorManager.stopAll()
})