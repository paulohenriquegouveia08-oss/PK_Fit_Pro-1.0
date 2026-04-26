import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { adminGlobalMenuItems as menuItems } from '../../../shared/config/adminGlobalMenu';
import { supabase } from '../../../shared/services/supabase';
import '../styles/agente-download.css';

interface AcademyTurnstileStatus {
    academy_name: string;
    turnstile_name: string;
    brand: string;
    model: string | null;
    connection_status: string;
    last_heartbeat: string | null;
}

const AGENT_VERSION = '1.0.0';
const AGENT_DOWNLOAD_URL = '/downloads/PKFitAgent-Setup.exe';

export default function AgenteDownload() {
    const [statuses, setStatuses] = useState<AcademyTurnstileStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadStatuses = async (showRefresh = false) => {
        if (showRefresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const { data, error } = await supabase
                .from('turnstile_configs')
                .select(`
                    name,
                    brand,
                    model,
                    connection_status,
                    last_heartbeat,
                    academies!inner(name)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                // Fallback: try without join
                const { data: configs } = await supabase
                    .from('turnstile_configs')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (configs) {
                    // Get unique academy IDs and fetch names
                    const academyIds = [...new Set(configs.map(c => c.academy_id))];
                    const { data: academies } = await supabase
                        .from('academies')
                        .select('id, name')
                        .in('id', academyIds);

                    const academyMap = new Map(
                        (academies || []).map(a => [a.id, a.name])
                    );

                    setStatuses(configs.map(c => ({
                        academy_name: academyMap.get(c.academy_id) || 'Academia',
                        turnstile_name: c.name,
                        brand: c.brand,
                        model: c.model,
                        connection_status: c.connection_status,
                        last_heartbeat: c.last_heartbeat
                    })));
                }
            } else if (data) {
                setStatuses(data.map((item: any) => ({
                    academy_name: item.academies?.name || 'Academia',
                    turnstile_name: item.name,
                    brand: item.brand,
                    model: item.model,
                    connection_status: item.connection_status,
                    last_heartbeat: item.last_heartbeat
                })));
            }
        } catch (err) {
            console.error('Error loading turnstile statuses:', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadStatuses();
    }, []);

    const formatHeartbeat = (dateStr: string | null) => {
        if (!dateStr) return 'Nunca';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return 'Agora';
        if (diffMin < 60) return `${diffMin}min atrás`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours}h atrás`;
        return d.toLocaleDateString('pt-BR');
    };

    const getBrandLabel = (brand: string) => {
        const map: Record<string, string> = {
            'CONTROL_ID': 'Control ID',
            'TOP_DATA': 'Top Data',
            'HENRY': 'Henry'
        };
        return map[brand] || brand;
    };

    const getStatusLabel = (status: string) => {
        const map: Record<string, string> = {
            'CONNECTED': 'Conectado',
            'DISCONNECTED': 'Desconectado',
            'ERROR': 'Erro'
        };
        return map[status] || status;
    };

    const connectedCount = statuses.filter(s => s.connection_status === 'CONNECTED').length;
    const totalCount = statuses.length;

    return (
        <DashboardLayout title="Agente Catraca" menuItems={menuItems}>
            <div className="agente-download">
                {/* Hero Section */}
                <div className="agent-hero">
                    <div className="agent-hero-content">
                        <div className="agent-hero-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                            </svg>
                        </div>
                        <h2>PK Fit Agent — Controle de Catraca</h2>
                        <p>
                            Software que roda no computador da academia, conectando-se à catraca
                            física e sincronizando os dados de acesso em tempo real com o sistema PK Fit Pro.
                        </p>
                        <a
                            href={AGENT_DOWNLOAD_URL}
                            className="agent-download-btn"
                            download="PKFitAgent-Setup.exe"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                            </svg>
                            Baixar PKFitAgent.exe
                        </a>
                        <div className="agent-version-tag">
                            v{AGENT_VERSION} • Windows 10/11
                        </div>
                    </div>
                </div>

                {/* How it Works */}
                <div className="agent-steps-section">
                    <h3 className="agent-section-title">Como Funciona</h3>
                    <p className="agent-section-subtitle">
                        4 passos simples para conectar a catraca da academia ao sistema
                    </p>
                    <div className="agent-steps-grid">
                        <div className="agent-step">
                            <div className="agent-step-number">
                                <svg className="agent-step-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                                </svg>
                            </div>
                            <div className="agent-step-title">1. Download</div>
                            <div className="agent-step-desc">
                                Baixe o instalador do Agent no computador da academia
                            </div>
                        </div>
                        <div className="agent-step">
                            <div className="agent-step-number">
                                <svg className="agent-step-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10H8v-2h6v2zm4-4H8v-2h10v2z" />
                                </svg>
                            </div>
                            <div className="agent-step-title">2. Instalar</div>
                            <div className="agent-step-desc">
                                Execute o instalador e siga as instruções na tela
                            </div>
                        </div>
                        <div className="agent-step">
                            <div className="agent-step-number">
                                <svg className="agent-step-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                                </svg>
                            </div>
                            <div className="agent-step-title">3. Parear</div>
                            <div className="agent-step-desc">
                                Gere o código de pareamento no painel da academia e insira no Agent
                            </div>
                        </div>
                        <div className="agent-step">
                            <div className="agent-step-number">
                                <svg className="agent-step-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                            </div>
                            <div className="agent-step-title">4. Pronto!</div>
                            <div className="agent-step-desc">
                                A catraca estará conectada e controlando acessos automaticamente
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Requirements */}
                <div className="agent-requirements">
                    <h3 className="agent-section-title">Requisitos do Sistema</h3>
                    <p className="agent-section-subtitle">
                        O computador da academia precisa atender estes requisitos mínimos
                    </p>
                    <div className="agent-req-grid">
                        <div className="agent-req-card">
                            <div className="agent-req-icon">🖥️</div>
                            <div className="agent-req-info">
                                <div className="agent-req-title">Sistema Operacional</div>
                                <div className="agent-req-value">Windows 10 ou superior</div>
                            </div>
                        </div>
                        <div className="agent-req-card">
                            <div className="agent-req-icon">💾</div>
                            <div className="agent-req-info">
                                <div className="agent-req-title">Memória RAM</div>
                                <div className="agent-req-value">Mínimo 2 GB</div>
                            </div>
                        </div>
                        <div className="agent-req-card">
                            <div className="agent-req-icon">🌐</div>
                            <div className="agent-req-info">
                                <div className="agent-req-title">Internet</div>
                                <div className="agent-req-value">Conexão estável (Wi-Fi ou cabo)</div>
                            </div>
                        </div>
                        <div className="agent-req-card">
                            <div className="agent-req-icon">🔌</div>
                            <div className="agent-req-info">
                                <div className="agent-req-title">Rede Local</div>
                                <div className="agent-req-value">Mesma rede que a catraca</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Connection Status */}
                <div className="agent-status-section">
                    <div className="agent-status-header">
                        <h3>
                            📡 Status das Conexões
                            {totalCount > 0 && (
                                <span style={{
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 'var(--font-weight-normal)',
                                    color: 'var(--text-secondary)',
                                    marginLeft: 'var(--spacing-2)'
                                }}>
                                    ({connectedCount}/{totalCount} conectadas)
                                </span>
                            )}
                        </h3>
                        <button
                            className={`agent-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                            onClick={() => loadStatuses(true)}
                            disabled={isRefreshing}
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                            </svg>
                            Atualizar
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="agent-loading">
                            <div className="agent-spinner"></div>
                            <p>Carregando status...</p>
                        </div>
                    ) : statuses.length === 0 ? (
                        <div className="agent-empty-status">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                            </svg>
                            <p>Nenhuma catraca configurada nas academias</p>
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)' }}>
                                As academias precisam configurar suas catracas no painel "Controle de Acesso" para aparecerem aqui.
                            </span>
                        </div>
                    ) : (
                        <table className="agent-status-table">
                            <thead>
                                <tr>
                                    <th>Academia</th>
                                    <th>Catraca</th>
                                    <th>Marca / Modelo</th>
                                    <th>Status</th>
                                    <th>Último Heartbeat</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statuses.map((s, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 'var(--font-weight-medium)' }}>
                                            {s.academy_name}
                                        </td>
                                        <td>{s.turnstile_name}</td>
                                        <td>
                                            {getBrandLabel(s.brand)}
                                            {s.model && ` — ${s.model}`}
                                        </td>
                                        <td>
                                            <span className={`agent-connection-badge ${s.connection_status}`}>
                                                <span className="agent-connection-dot"></span>
                                                {getStatusLabel(s.connection_status)}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)' }}>
                                            {formatHeartbeat(s.last_heartbeat)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
