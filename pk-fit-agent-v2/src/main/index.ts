import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { redeemPairingCode, loadLocalConfig, hasLocalConfig, LocalConfig } from './core/setup'
import { logger } from './core/logger'
import { configFromLocal } from './config'
import { createAdapter } from './adapters/adapter.factory'
import { TurnstileAdapter } from './adapters/adapter.interface'
import { AccessController } from './core/access-controller'
import { initSupabase } from './supabase/client'
import { startHeartbeat, stopHeartbeat, markDisconnected } from './core/heartbeat'
import { startListener, stopListener } from './supabase/listener'
import { processPendingCommands } from './supabase/sync'

let mainWindow: BrowserWindow | null = null
let currentAdapter: TurnstileAdapter | null = null
let currentConfig: LocalConfig | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Bind logger to window
  logger.onLogCallback = (log) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent-log', log)
    }
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pkfit.agent')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('has-config', () => {
    return hasLocalConfig()
  })

  ipcMain.handle('get-config', () => {
    return loadLocalConfig()
  })

  ipcMain.handle('pair', async (_, code: string) => {
    try {
      const config = await redeemPairingCode(code)
      currentConfig = config
      return { success: true, config }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('connect', async () => {
    try {
      if (!currentConfig) {
        currentConfig = loadLocalConfig()
      }
      if (!currentConfig) throw new Error('No config found')

      const config = configFromLocal(currentConfig)
      logger.setLevel(config.logLevel)

      initSupabase(config)
      currentAdapter = createAdapter(config)
      await currentAdapter.connect()

      startHeartbeat(config)
      await processPendingCommands(config)
      startListener(config, currentAdapter)

      const { syncAcademyMembers } = await import('./supabase/userSync')
      syncAcademyMembers(config, currentAdapter) // Inicia sync de usuários em segundo plano

      const controller = new AccessController(currentAdapter, config)
      controller.start()

      logger.info('🚀 Agent conectado!')
      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error('Falha na conexão: ' + msg)
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('manual-action', async (_, action: 'grant' | 'deny') => {
    if (!currentAdapter) return { success: false, error: 'Not connected' }
    try {
      if (action === 'grant') {
        await currentAdapter.grantAccess('IN')
        logger.access(true, 'Acesso Manual', 'Liberado pelo administrador via painel')
      } else {
        await currentAdapter.denyAccess()
        logger.access(false, 'Bloqueio Manual', 'Bloqueado pelo administrador via painel')
      }
      return { success: true }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { success: false, error: msg }
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (e) => {
  if (currentAdapter) {
    e.preventDefault()
    try {
      stopHeartbeat()
      await stopListener()
      await currentAdapter.disconnect()
      if (currentConfig) await markDisconnected(configFromLocal(currentConfig))
    } finally {
      currentAdapter = null
      app.quit()
    }
  }
})
