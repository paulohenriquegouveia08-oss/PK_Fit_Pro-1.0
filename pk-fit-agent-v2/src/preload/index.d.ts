import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      hasConfig: () => Promise<boolean>
      getConfig: () => Promise<any>
      pair: (code: string) => Promise<{ success: boolean; config?: any; error?: string }>
      connect: () => Promise<{ success: boolean; error?: string }>
      manualAction: (action: 'grant' | 'deny') => Promise<{ success: boolean; error?: string }>
      onAgentLog: (
        callback: (log: { level: string; message: string; data?: any; timestamp: string }) => void
      ) => void
    }
  }
}
