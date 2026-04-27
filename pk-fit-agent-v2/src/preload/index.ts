import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  hasConfig: () => ipcRenderer.invoke('has-config'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  pair: (code: string) => ipcRenderer.invoke('pair', code),
  connect: () => ipcRenderer.invoke('connect'),
  manualAction: (action: 'grant' | 'deny') => ipcRenderer.invoke('manual-action', action),
  onAgentLog: (callback: (log: any) => void) => {
    ipcRenderer.on('agent-log', (_event, log) => callback(log))
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
