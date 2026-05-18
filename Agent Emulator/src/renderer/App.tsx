import { useState, useEffect, useCallback } from 'react'
import type { EmulatorStatus, EmulatorEvent, NetworkSimulation, DeviceStatus } from './types'

function DeviceConfigEditor({ device, onSave }: { device: DeviceStatus, onSave: (deviceId: string, ip: string, port: number) => void }) {
  const [ip, setIp] = useState(device.ip)
  const [port, setPort] = useState(device.port)

  return (
    <div className="text-dark-400 text-sm flex items-center gap-2 mt-1">
      IP: 
      <input 
        className="bg-dark-800 text-white border border-dark-600 rounded px-1 w-28 text-xs" 
        value={ip} 
        onChange={(e) => setIp(e.target.value)}
      /> 
      Porta: 
      <input 
        className="bg-dark-800 text-white border border-dark-600 rounded px-1 w-16 text-xs" 
        type="number" 
        value={port} 
        onChange={(e) => setPort(parseInt(e.target.value) || 8080)}
      /> 
      <button 
        onClick={() => onSave(device.id, ip, port)}
        className="px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded text-xs text-white ml-1"
      >
        Salvar
      </button>
      <span className="ml-2">| FW: {device.firmware}</span>
    </div>
  )
}

export default function App() {
  const [status, setStatus] = useState<EmulatorStatus | null>(null)
  const [logs, setLogs] = useState<EmulatorEvent[]>([])
  const [loading, setLoading] = useState(true)

  const loadStatus = useCallback(async () => {
    try {
      const data = await window.emulatorAPI.getStatus()
      setStatus(data)
    } catch (error) {
      console.error('Failed to load status:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()

    const interval = setInterval(loadStatus, 2000)

    return () => clearInterval(interval)
  }, [loadStatus])

  useEffect(() => {
    const unsubscribe = window.emulatorAPI.onEvent((event: EmulatorEvent) => {
      setLogs(prev => [event, ...prev].slice(0, 500))
    })

    return unsubscribe
  }, [])

  const handleStart = async () => {
    setLoading(true)
    await window.emulatorAPI.start()
    await loadStatus()
    setLoading(false)
  }

  const handleStop = async () => {
    setLoading(true)
    await window.emulatorAPI.stop()
    await loadStatus()
    setLoading(false)
  }

  const handleSimulateAction = async (deviceId: string, action: string) => {
    await window.emulatorAPI.simulateAction(deviceId, action)
    await loadStatus()
  }

  const handleOpenGate = async (deviceId: string) => {
    await window.emulatorAPI.openGate(deviceId, `user-${Date.now()}`)
    await loadStatus()
  }

  const handleUpdateConfig = async (deviceId: string, ip: string, port: number) => {
    const res = await window.emulatorAPI.updateDeviceConfig(deviceId, ip, port)
    if (!res.success) {
      alert('Falha ao salvar configuração: ' + res.error)
    }
    await loadStatus()
  }

  const handleNetworkChange = async (key: keyof NetworkSimulation, value: boolean | number) => {
    if (!status) return
    const newNetwork = { ...status.network, [key]: value }
    await window.emulatorAPI.setNetworkSimulation(newNetwork)
    await loadStatus()
  }

  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('pt-BR')
  }

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-dark-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">PK Fit Hardware Emulator</h1>
        <p className="text-dark-400 mt-1">Emulação de catracas e controladores de acesso</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-dark-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Status do Emulador</h2>
              <div className="flex gap-2">
                {!status?.running ? (
                  <button
                    onClick={handleStart}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium disabled:opacity-50"
                  >
                    Iniciar
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium disabled:opacity-50"
                  >
                    Parar
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-dark-700 rounded p-4">
                <div className="text-dark-400 text-sm">Status</div>
                <div className={`text-2xl font-bold ${status?.running ? 'text-green-500' : 'text-red-500'}`}>
                  {status?.running ? 'Online' : 'Offline'}
                </div>
              </div>
              <div className="bg-dark-700 rounded p-4">
                <div className="text-dark-400 text-sm">Porta</div>
                <div className="text-2xl font-bold">{status?.port || '-'}</div>
              </div>
              <div className="bg-dark-700 rounded p-4">
                <div className="text-dark-400 text-sm">Dispositivos</div>
                <div className="text-2xl font-bold">{status?.metrics.activeDevices || 0}</div>
              </div>
              <div className="bg-dark-700 rounded p-4">
                <div className="text-dark-400 text-sm">Uptime</div>
                <div className="text-2xl font-bold">{status?.metrics.uptime ? formatUptime(status.metrics.uptime) : '-'}</div>
              </div>
            </div>
          </div>

          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Dispositivos</h2>
            <div className="space-y-3">
              {status?.devices.map(device => (
                <div key={device.id} className="bg-dark-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${device.status?.online ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-semibold">{device.brand} {device.model}</div>
                        <DeviceConfigEditor device={device} onSave={handleUpdateConfig} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenGate(device.id)}
                        disabled={!status.running || !device.status?.online}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm disabled:opacity-50"
                      >
                        Abrir Catraca
                      </button>
                      <button
                        onClick={() => handleSimulateAction(device.id, 'offline')}
                        disabled={!status.running}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm disabled:opacity-50"
                      >
                        Offline
                      </button>
                      <button
                        onClick={() => handleSimulateAction(device.id, 'online')}
                        disabled={!status.running}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
                      >
                        Online
                      </button>
                      <button
                        onClick={() => handleSimulateAction(device.id, 'timeout')}
                        disabled={!status.running}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm disabled:opacity-50"
                      >
                        Timeout
                      </button>
                      <button
                        onClick={() => handleSimulateAction(device.id, 'error')}
                        disabled={!status.running}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm disabled:opacity-50"
                      >
                        Erro
                      </button>
                    </div>
                  </div>
                  {device.status && (
                    <div className="mt-2 text-sm text-dark-400">
                      Latência: {device.status.latency}ms | Uptime: {formatUptime(device.status.uptime)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Simulação de Rede</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center justify-between bg-dark-700 rounded p-3">
                <span>Habilitar Simulação</span>
                <input
                  type="checkbox"
                  checked={status?.network.enabled || false}
                  onChange={e => handleNetworkChange('enabled', e.target.checked)}
                  className="w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between bg-dark-700 rounded p-3">
                <span>Latência (ms)</span>
                <input
                  type="number"
                  value={status?.network.latencyMs || 0}
                  onChange={e => handleNetworkChange('latencyMs', parseInt(e.target.value) || 0)}
                  className="w-20 bg-dark-600 border border-dark-500 rounded px-2 py-1 text-center"
                  min="0"
                  max="10000"
                />
              </div>
              <div className="flex items-center justify-between bg-dark-700 rounded p-3">
                <span>Perda de Pacotes (%)</span>
                <input
                  type="number"
                  value={Math.round((status?.network.packetLossRate || 0) * 100)}
                  onChange={e => handleNetworkChange('packetLossRate', (parseInt(e.target.value) || 0) / 100)}
                  className="w-20 bg-dark-600 border border-dark-500 rounded px-2 py-1 text-center"
                  min="0"
                  max="100"
                />
              </div>
              <div className="flex items-center justify-between bg-dark-700 rounded p-3">
                <span>Modo Caos</span>
                <input
                  type="checkbox"
                  checked={status?.network.chaosMode || false}
                  onChange={e => handleNetworkChange('chaosMode', e.target.checked)}
                  className="w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between bg-dark-700 rounded p-3">
                <span>Taxa de Falha (%)</span>
                <input
                  type="number"
                  value={Math.round((status?.network.chaosFailureRate || 0) * 100)}
                  onChange={e => handleNetworkChange('chaosFailureRate', (parseInt(e.target.value) || 0) / 100)}
                  className="w-20 bg-dark-600 border border-dark-500 rounded px-2 py-1 text-center"
                  min="0"
                  max="100"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-dark-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Métricas</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-400">Total de Requests</span>
                <span className="font-semibold">{status?.metrics.totalRequests || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Sucesso</span>
                <span className="font-semibold text-green-500">{status?.metrics.successfulRequests || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Falhas</span>
                <span className="font-semibold text-red-500">{status?.metrics.failedRequests || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Latência Média</span>
                <span className="font-semibold">{status?.metrics.averageLatency || 0}ms</span>
              </div>
            </div>
          </div>

          <div className="bg-dark-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Logs em Tempo Real</h2>
              <button
                onClick={() => setLogs([])}
                className="text-sm text-dark-400 hover:text-white"
              >
                Limpar
              </button>
            </div>
            <div className="h-96 overflow-y-auto bg-dark-900 rounded">
              {logs.length === 0 ? (
                <div className="text-dark-400 text-center py-8">Nenhum evento</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={`${log.id}-${idx}`} className={`log-entry ${log.type}`}>
                    <span className="text-dark-500">[{formatTime(log.timestamp)}]</span>{' '}
                    <span className="text-dark-300">{log.deviceBrand}</span>{' '}
                    <span className="text-white">{log.type.replace('_', ' ')}</span>
                    {!!log.data?.userId && <span className="text-blue-400"> ({String(log.data.userId)})</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}