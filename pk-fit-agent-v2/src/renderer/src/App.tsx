import React, { useState, useEffect, useRef } from 'react'

type LogEntry = { level: string; message: string; timestamp: string };

function App(): React.ReactNode {
  const [hasConfig, setHasConfig] = useState<boolean | null>(null)
  const [config, setConfig] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const logsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check initial state
    window.api.hasConfig().then(async (exists) => {
      setHasConfig(exists);
      if (exists) {
        const cfg = await window.api.getConfig();
        setConfig(cfg);
      }
    });

    // Listen for agent logs
    window.api.onAgentLog((log) => {
      setLogs((prev) => [...prev, log].slice(-100)); // Keep last 100 logs
    });
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await window.api.pair(code);
    if (res.success) {
      setHasConfig(true);
      setConfig(res.config);
    } else {
      setError(res.error || 'Erro desconhecido');
    }
    setLoading(false);
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    const res = await window.api.connect();
    if (res.success) {
      setIsConnected(true);
    } else {
      setError(res.error || 'Erro interno de conexão');
    }
    setLoading(false);
  };

  const handleManual = async (action: 'grant' | 'deny') => {
    await window.api.manualAction(action);
  };

  if (hasConfig === null) return <div className="loader">Carregando...</div>;

  return (
    <div className="container">
      <header className="header">
        <h1>PK Fit Agent</h1>
        <p className="subtitle">Sincronizador de Catraca Local</p>
      </header>

      {!hasConfig ? (
        <div className="card setup-card">
          <h2>🔗 Primeiro Uso</h2>
          <p>Informe o código de 6 dígitos gerado no painel web da academia.</p>

          <form onSubmit={handlePair}>
            <input
              type="text"
              placeholder="Código (ex: AB1234)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={loading}
              className="input-field"
            />
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Validando...' : 'Parear Catraca'}
            </button>
          </form>
        </div>
      ) : (
        <div className="dashboard">
          <div className="card status-card">
            <div className="status-header">
              <h2>✅ Catraca Pareada</h2>
              <span className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
                {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
              </span>
            </div>
            <div className="config-info">
              <p><strong>Academia:</strong> {config?.academyName}</p>
              <p><strong>Catraca:</strong> {config?.turnstileName} ({config?.brand})</p>
              <p><strong>IP:</strong> {config?.ipAddress}:{config?.port}</p>
            </div>
            
            {!isConnected && (
              <button 
                className="btn-success w-full" 
                onClick={handleConnect} 
                disabled={loading}
              >
                {loading ? 'Conectando...' : '⚡ Iniciar Conexão'}
              </button>
            )}
            {error && <div className="error">{error}</div>}
            
            {isConnected && (
              <div className="manual-actions">
                <button className="btn-success" onClick={() => handleManual('grant')}>
                  🔓 Liberar (Manual)
                </button>
                <button className="btn-danger" onClick={() => handleManual('deny')}>
                  🔒 Bloquear (Manual)
                </button>
              </div>
            )}
          </div>

          <div className="card logs-card">
            <h3>📜 Logs em Tempo Real</h3>
            <div className="logs-container">
              {logs.length === 0 && <p className="text-muted">Nenhum log ainda...</p>}
              {logs.map((log, i) => (
                <div key={i} className={`log-entry log-${log.level}`}>
                  <span className="log-time">[{log.timestamp}]</span>
                  <span className="log-msg"> {log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
