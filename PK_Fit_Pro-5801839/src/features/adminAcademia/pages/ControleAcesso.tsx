import { useState, useEffect, type FormEvent } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';
import { getCurrentAcademyId } from '../../../shared/services/academyMember.service';
import {
    getTurnstileConfigs,
    createTurnstileConfig,
    updateTurnstileConfig,
    deleteTurnstileConfig,
    getAccessLogs,
    getAcademyOccupancy,
    getTodayAccessStats,
    registerAccessLog,
    sendTurnstileCommand,
    generatePairingCode,
    TURNSTILE_BRANDS,
    type TurnstileConfig,
    type AccessLog,
    type TurnstileBrand
} from '../../../shared/services/turnstile.service';
import { supabase } from '../../../shared/services/supabase';
import { getUserById } from '../../../shared/services/user.service';
import '../styles/controle-acesso.css';

interface ExtendedAccessLog extends AccessLog {
    photo_url?: string;
}

type TabType = 'dashboard' | 'config' | 'logs';

interface ConfigFormData {
    name: string;
    brand: TurnstileBrand | '';
    model: string;
    ip_address: string;
    port: string;
    auth_user: string;
    auth_password: string;
}

const initialFormData: ConfigFormData = {
    name: 'Catraca Principal',
    brand: '',
    model: '',
    ip_address: '',
    port: '80',
    auth_user: '',
    auth_password: ''
};

export default function ControleAcesso() {
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [isLoading, setIsLoading] = useState(true);

    // Config state
    const [configs, setConfigs] = useState<TurnstileConfig[]>([]);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [editingConfig, setEditingConfig] = useState<TurnstileConfig | null>(null);
    const [formData, setFormData] = useState<ConfigFormData>(initialFormData);
    const [saving, setSaving] = useState(false);

    // Logs state
    const [logs, setLogs] = useState<AccessLog[]>([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [logsPage, setLogsPage] = useState(0);
    const [logFilter, setLogFilter] = useState<'all' | 'granted' | 'denied'>('all');
    const [logDateFrom, setLogDateFrom] = useState('');
    const [logDateTo, setLogDateTo] = useState('');
    const [logsLoading, setLogsLoading] = useState(false);
    const [realtimeLogs, setRealtimeLogs] = useState<ExtendedAccessLog[]>([]);

    // Stats
    const [occupancy, setOccupancy] = useState(0);
    const [todayStats, setTodayStats] = useState({ total_entries: 0, total_denied: 0, by_reason: {} as Record<string, number> });

    // Messages
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Pairing code
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [showPairingModal, setShowPairingModal] = useState(false);
    const [pairingLoading, setPairingLoading] = useState(false);
    const [pairingConfigName, setPairingConfigName] = useState('');

    const LOGS_PER_PAGE = 20;

    // ==========================================
    // LOAD DATA
    // ==========================================

    const loadConfigs = async () => {
        const academyId = getCurrentAcademyId();
        if (!academyId) return;

        const result = await getTurnstileConfigs(academyId);
        if (result.success && result.data) {
            setConfigs(result.data);
        }
    };

    const loadStats = async () => {
        const academyId = getCurrentAcademyId();
        if (!academyId) return;

        const [occupancyRes, statsRes] = await Promise.all([
            getAcademyOccupancy(academyId),
            getTodayAccessStats(academyId)
        ]);

        if (occupancyRes.success && occupancyRes.data !== undefined) {
            setOccupancy(occupancyRes.data);
        }
        if (statsRes.success && statsRes.data) {
            setTodayStats(statsRes.data);
        }
    };

    const loadLogs = async (page: number = 0) => {
        const academyId = getCurrentAcademyId();
        if (!academyId) return;

        setLogsLoading(true);
        const result = await getAccessLogs(academyId, {
            limit: LOGS_PER_PAGE,
            offset: page * LOGS_PER_PAGE,
            dateFrom: logDateFrom || undefined,
            dateTo: logDateTo || undefined,
            onlyGranted: logFilter === 'granted' ? true : undefined,
            onlyDenied: logFilter === 'denied' ? true : undefined
        });

        if (result.success && result.data) {
            setLogs(result.data.logs);
            setTotalLogs(result.data.total);
        }
        setLogsLoading(false);
    };

    const loadAllData = async () => {
        setIsLoading(true);
        await Promise.all([loadConfigs(), loadStats()]);
        setIsLoading(false);
    };

    useEffect(() => {
        loadAllData();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') {
            loadLogs(logsPage);
        }
    }, [activeTab, logsPage, logFilter, logDateFrom, logDateTo]);

    // Som de notificação
    const playNotificationSound = () => {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.error('Erro ao tocar som:', e));
    };

    // Realtime subscription
    useEffect(() => {
        const academyId = getCurrentAcademyId();
        if (!academyId) return;

        const channel = supabase
            .channel('realtime_access_logs')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'access_logs',
                    filter: `academy_id=eq.${academyId}`
                },
                async (payload) => {
                    const newLog = payload.new as AccessLog;
                    
                    // Buscar foto do usuário
                    let photoUrl = undefined;
                    if (newLog.user_id) {
                        const userRes = await getUserById(newLog.user_id);
                        if (userRes.success) photoUrl = userRes.data?.photo_url;
                    }

                    setRealtimeLogs(prev => [{ ...newLog, photo_url: photoUrl }, ...prev].slice(0, 10));
                    
                    // Tocar som se for acesso permitido
                    if (newLog.access_granted) {
                        playNotificationSound();
                    }

                    // Se estiver na aba de logs, recarregar a primeira página para manter sincronizado com o histórico real
                    if (activeTab === 'logs' && logsPage === 0) {
                        loadLogs(0);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeTab, logsPage]);

    // ==========================================
    // CONFIG CRUD
    // ==========================================

    const handleConfigSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const academyId = getCurrentAcademyId();
        if (!academyId) return;

        if (!formData.brand) {
            setMessage({ type: 'error', text: 'Selecione a marca da catraca' });
            return;
        }

        setSaving(true);

        if (editingConfig) {
            const result = await updateTurnstileConfig(editingConfig.id, {
                name: formData.name,
                brand: formData.brand as TurnstileBrand,
                model: formData.model || null,
                ip_address: formData.ip_address || null,
                port: parseInt(formData.port) || 80,
                auth_user: formData.auth_user || null,
                auth_password: formData.auth_password || null
            });

            if (result.success) {
                setMessage({ type: 'success', text: 'Catraca atualizada com sucesso!' });
                setShowConfigModal(false);
                loadConfigs();
            } else {
                setMessage({ type: 'error', text: result.error || 'Erro ao atualizar' });
            }
        } else {
            const result = await createTurnstileConfig({
                academy_id: academyId,
                name: formData.name,
                brand: formData.brand as TurnstileBrand,
                model: formData.model || undefined,
                ip_address: formData.ip_address || undefined,
                port: parseInt(formData.port) || 80,
                auth_user: formData.auth_user || undefined,
                auth_password: formData.auth_password || undefined
            });

            if (result.success) {
                setMessage({ type: 'success', text: 'Catraca configurada com sucesso!' });
                setShowConfigModal(false);
                loadConfigs();
            } else {
                setMessage({ type: 'error', text: result.error || 'Erro ao configurar' });
            }
        }

        setSaving(false);
    };

    const handleEditConfig = (config: TurnstileConfig) => {
        setEditingConfig(config);
        setFormData({
            name: config.name,
            brand: config.brand,
            model: config.model || '',
            ip_address: config.ip_address || '',
            port: String(config.port),
            auth_user: config.auth_user || '',
            auth_password: config.auth_password || ''
        });
        setShowConfigModal(true);
    };

    const handleDeleteConfig = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir esta configuração?')) return;
        const result = await deleteTurnstileConfig(id);
        if (result.success) {
            setMessage({ type: 'success', text: 'Configuração excluída' });
            loadConfigs();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao excluir' });
        }
    };

    const handleManualAccess = async (configId: string) => {
        const academyId = getCurrentAcademyId();
        if (!academyId) return;

        const result = await sendTurnstileCommand({
            academy_id: academyId,
            turnstile_config_id: configId,
            command_type: 'GRANT_ACCESS',
            payload: { manual: true }
        });

        // Also log a manual access
        await registerAccessLog({
            academy_id: academyId,
            turnstile_config_id: configId,
            direction: 'IN',
            access_granted: true,
            identification_method: 'MANUAL',
            user_name: 'Liberação Manual'
        });

        if (result.success) {
            setMessage({ type: 'success', text: '✅ Acesso liberado manualmente!' });
            loadStats();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao liberar' });
        }
    };

    const openNewConfigModal = () => {
        setEditingConfig(null);
        setFormData(initialFormData);
        setShowConfigModal(true);
    };

    const handleGeneratePairingCode = async (config: TurnstileConfig) => {
        const academyId = getCurrentAcademyId();
        if (!academyId) return;

        setPairingLoading(true);
        setPairingConfigName(config.name);
        setShowPairingModal(true);

        const result = await generatePairingCode(academyId, config.id);

        if (result.success && result.data) {
            setPairingCode(result.data);
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao gerar código' });
            setShowPairingModal(false);
        }
        setPairingLoading(false);
    };

    const copyPairingCode = () => {
        if (pairingCode) {
            navigator.clipboard.writeText(pairingCode);
            setMessage({ type: 'success', text: 'Código copiado!' });
        }
    };

    // ==========================================
    // HELPERS
    // ==========================================

    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const getSelectedBrandModels = () => {
        if (!formData.brand) return [];
        return TURNSTILE_BRANDS.find(b => b.value === formData.brand)?.models || [];
    };

    const getDenialReasonLabel = (reason: string | null) => {
        const map: Record<string, string> = {
            'INADIMPLENTE': 'Inadimplente',
            'BLOQUEADO': 'Bloqueado',
            'FORA_DO_HORARIO': 'Fora do Horário',
            'PLANO_VENCIDO': 'Plano Vencido',
            'NAO_ENCONTRADO': 'Não Encontrado'
        };
        return map[reason || ''] || reason || '—';
    };

    const getMethodLabel = (method: string | null) => {
        const map: Record<string, string> = {
            'BIOMETRIC': '🔒 Biometria',
            'CARD': '💳 Cartão',
            'QR_CODE': '📱 QR Code',
            'FACIAL': '👤 Facial',
            'MANUAL': '🖐️ Manual'
        };
        return map[method || ''] || method || '—';
    };

    const totalPages = Math.ceil(totalLogs / LOGS_PER_PAGE);

    // Auto-clear messages
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // ==========================================
    // RENDER
    // ==========================================

    return (
        <DashboardLayout title="Controle de Acesso" menuItems={menuItems}>
            <div className="controle-acesso">
                {/* Header */}
                <div className="ca-header">
                    <h2>
                        <span className="ca-header-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                            </svg>
                        </span>
                        Controle de Acesso
                    </h2>
                    <button className="ca-add-btn" onClick={openNewConfigModal}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        Nova Catraca
                    </button>
                </div>

                {/* Message */}
                {message && (
                    <div className={`ca-message ${message.type}`}>
                        {message.type === 'success' ? '✅' : '❌'} {message.text}
                    </div>
                )}

                {/* Loading */}
                {isLoading ? (
                    <div className="ca-loading">
                        <div className="ca-spinner"></div>
                        <p>Carregando dados de acesso...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="ca-stats">
                            <div className="ca-stat-card">
                                <div className="ca-stat-icon occupancy">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                                    </svg>
                                </div>
                                <div className="ca-stat-info">
                                    <div className="ca-stat-value">{occupancy}</div>
                                    <div className="ca-stat-label">Pessoas agora na academia</div>
                                </div>
                            </div>

                            <div className="ca-stat-card">
                                <div className="ca-stat-icon entries">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M14 6l-1.41 1.41L16.17 11H4v2h12.17l-3.58 3.59L14 18l6-6z" />
                                    </svg>
                                </div>
                                <div className="ca-stat-info">
                                    <div className="ca-stat-value">{todayStats.total_entries}</div>
                                    <div className="ca-stat-label">Entradas hoje</div>
                                </div>
                            </div>

                            <div className="ca-stat-card">
                                <div className="ca-stat-icon denied">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z" />
                                    </svg>
                                </div>
                                <div className="ca-stat-info">
                                    <div className="ca-stat-value">{todayStats.total_denied}</div>
                                    <div className="ca-stat-label">Acessos negados hoje</div>
                                </div>
                            </div>

                            <div className="ca-stat-card">
                                <div className="ca-stat-icon connection">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                                    </svg>
                                </div>
                                <div className="ca-stat-info">
                                    <div className="ca-stat-value">{configs.filter(c => c.connection_status === 'CONNECTED').length}/{configs.length}</div>
                                    <div className="ca-stat-label">Catracas conectadas</div>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="ca-tabs">
                            <button className={`ca-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                                📊 Resumo
                            </button>
                            <button className={`ca-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
                                ⚙️ Catracas
                            </button>
                            <button className={`ca-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
                                📋 Logs de Acesso
                            </button>
                        </div>

                        {/* ==========================================
                            TAB: Dashboard / Resumo
                           ========================================== */}
                        {activeTab === 'dashboard' && (
                            <div className="ca-config-section">
                                {/* Denied reasons breakdown */}
                                {todayStats.total_denied > 0 && (
                                    <div style={{ marginBottom: 'var(--spacing-6)' }}>
                                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--gray-800)', marginBottom: 'var(--spacing-3)' }}>
                                            🚫 Motivos de Bloqueio Hoje
                                        </h3>
                                        <div className="ca-config-cards">
                                            {Object.entries(todayStats.by_reason).map(([reason, count]) => (
                                                <div key={reason} className="ca-config-card" style={{ borderLeft: '4px solid var(--error-500)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--gray-800)' }}>
                                                            {getDenialReasonLabel(reason)}
                                                        </span>
                                                        <span style={{
                                                            background: 'var(--error-100)',
                                                            color: 'var(--error-700)',
                                                            padding: '2px 10px',
                                                            borderRadius: 'var(--radius-full)',
                                                            fontWeight: 'var(--font-weight-bold)',
                                                            fontSize: 'var(--font-size-sm)'
                                                        }}>
                                                            {count}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Quick actions */}
                                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--gray-800)', marginBottom: 'var(--spacing-3)' }}>
                                    🏋️ Catracas Configuradas
                                </h3>
                                {configs.length === 0 ? (
                                    <div className="ca-config-empty">
                                        <div className="ca-config-empty-icon">
                                            <svg viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                                            </svg>
                                        </div>
                                        <h3>Nenhuma catraca configurada</h3>
                                        <p>Configure sua primeira catraca para começar a controlar o acesso da academia.</p>
                                        <button className="ca-add-btn" onClick={openNewConfigModal}>
                                            <svg viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                            </svg>
                                            Configurar Catraca
                                        </button>
                                    </div>
                                ) : (
                                    <div className="ca-config-cards">
                                        {configs.map(config => (
                                            <div key={config.id} className="ca-config-card">
                                                <div className="ca-config-card-header">
                                                    <div className="ca-config-card-info">
                                                        <span className={`ca-brand-badge ${config.brand}`}>
                                                            {TURNSTILE_BRANDS.find(b => b.value === config.brand)?.label || config.brand}
                                                        </span>
                                                        <div>
                                                            <div className="ca-config-card-name">{config.name}</div>
                                                            {config.model && <div className="ca-config-card-model">{config.model}</div>}
                                                        </div>
                                                    </div>
                                                    <div className={`ca-status-dot ${config.connection_status}`} title={config.connection_status}></div>
                                                </div>

                                                <div className="ca-config-details">
                                                    <div className="ca-config-detail">
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                                                        </svg>
                                                        <span className="value">{config.ip_address || 'Sem IP'}:{config.port}</span>
                                                    </div>
                                                    <div className="ca-config-detail">
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                                        </svg>
                                                        <span className="value">
                                                            {config.last_heartbeat
                                                                ? formatTime(config.last_heartbeat)
                                                                : 'Nunca'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="ca-config-actions">
                                                    <button className="ca-manual-btn" onClick={() => handleManualAccess(config.id)} title="Liberar acesso manualmente">
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6-3.1c1.71 0 3.1 1.39 3.1 3.1v2H8.9V6c0-1.71 1.39-3.1 3.1-3.1zM18 20H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
                                                        </svg>
                                                        Liberar
                                                    </button>
                                                    <button className="ca-btn-sm" onClick={() => handleEditConfig(config)}>
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                        </svg>
                                                        Editar
                                                    </button>
                                                    <button className="ca-btn-sm danger" onClick={() => handleDeleteConfig(config.id)}>
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                        </svg>
                                                        Excluir
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==========================================
                            TAB: Configurações
                           ========================================== */}
                        {activeTab === 'config' && (
                            <div className="ca-config-section">
                                {configs.length === 0 ? (
                                    <div className="ca-config-empty">
                                        <div className="ca-config-empty-icon">
                                            <svg viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                                            </svg>
                                        </div>
                                        <h3>Nenhuma catraca configurada</h3>
                                        <p>Adicione sua catraca — suportamos Control ID, Top Data e Henry.</p>
                                        <button className="ca-add-btn" onClick={openNewConfigModal}>
                                            <svg viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                            </svg>
                                            Adicionar Catraca
                                        </button>
                                    </div>
                                ) : (
                                    <div className="ca-config-cards">
                                        {configs.map(config => (
                                            <div key={config.id} className="ca-config-card">
                                                <div className="ca-config-card-header">
                                                    <div className="ca-config-card-info">
                                                        <span className={`ca-brand-badge ${config.brand}`}>
                                                            {TURNSTILE_BRANDS.find(b => b.value === config.brand)?.label || config.brand}
                                                        </span>
                                                        <div>
                                                            <div className="ca-config-card-name">{config.name}</div>
                                                            {config.model && <div className="ca-config-card-model">{config.model}</div>}
                                                        </div>
                                                    </div>
                                                    <div className={`ca-status-dot ${config.connection_status}`} title={config.connection_status}></div>
                                                </div>

                                                <div className="ca-config-details">
                                                    <div className="ca-config-detail">
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
                                                        </svg>
                                                        <span>IP: <span className="value">{config.ip_address || '—'}</span></span>
                                                    </div>
                                                    <div className="ca-config-detail">
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z" />
                                                        </svg>
                                                        <span>Porta: <span className="value">{config.port}</span></span>
                                                    </div>
                                                    <div className="ca-config-detail">
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                                                        </svg>
                                                        <span>Auth: <span className="value">{config.auth_user ? '✅' : '❌'}</span></span>
                                                    </div>
                                                    <div className="ca-config-detail">
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                                        </svg>
                                                        <span>Heartbeat: <span className="value">{config.last_heartbeat ? formatTime(config.last_heartbeat) : 'Nunca'}</span></span>
                                                    </div>
                                                </div>

                                                <div className="ca-config-actions">
                                                    <button className="ca-btn-sm pairing" onClick={() => handleGeneratePairingCode(config)} title="Gerar código para conectar o Agent">
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                                                        </svg>
                                                        Parear Agent
                                                    </button>
                                                    <button className="ca-btn-sm" onClick={() => handleEditConfig(config)}>
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                        </svg>
                                                        Editar
                                                    </button>
                                                    <button className="ca-btn-sm danger" onClick={() => handleDeleteConfig(config.id)}>
                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                        </svg>
                                                        Excluir
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ==========================================
                            TAB: Logs de Acesso
                           ========================================== */}
                        {activeTab === 'logs' && (
                            <div className="ca-logs-section">
                                <div style={{ marginBottom: 'var(--spacing-6)' }}>
                                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--gray-800)', marginBottom: 'var(--spacing-3)' }}>
                                        📋 Histórico e Monitoramento
                                    </h3>
                                    
                                    {/* Monitoramento em Tempo Real */}
                                    <div className="ca-realtime-monitor" style={{ 
                                        marginBottom: 'var(--spacing-6)',
                                        background: 'var(--gray-900)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--spacing-4)',
                                        color: '#fff',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div className="live-indicator-dot" style={{ width: '10px', height: '10px', background: '#4ade80', borderRadius: '50%', boxShadow: '0 0 10px #4ade80' }}></div>
                                                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', letterSpacing: '1px' }}>MONITORAMENTO AO VIVO</span>
                                            </div>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)' }}>Últimos 10 acessos</span>
                                        </div>

                                        {realtimeLogs.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: 'var(--spacing-6)', color: 'var(--gray-500)', border: '1px dashed var(--gray-700)', borderRadius: 'var(--radius-md)' }}>
                                                <p style={{ fontSize: 'var(--font-size-sm)' }}>Aguardando interações com a catraca...</p>
                                            </div>
                                        ) : (
                                            <div className="ca-realtime-list" style={{ 
                                                display: 'grid', 
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                                                gap: 'var(--spacing-3)' 
                                            }}>
                                                {realtimeLogs.map((log) => (
                                                    <div key={log.id} style={{ 
                                                        background: 'var(--gray-800)',
                                                        padding: 'var(--spacing-3)',
                                                        borderRadius: 'var(--radius-md)',
                                                        display: 'flex',
                                                        gap: 'var(--spacing-3)',
                                                        alignItems: 'center',
                                                        borderLeft: `4px solid ${log.access_granted ? '#10b981' : '#ef4444'}`,
                                                        animation: 'fadeInSlide 0.3s ease-out'
                                                    }}>
                                                        <div style={{ width: '45px', height: '45px', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--gray-700)', flexShrink: 0 }}>
                                                            {log.photo_url ? (
                                                                <img src={log.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: 'var(--gray-400)' }}>
                                                                    {log.user_name ? log.user_name.substring(0, 1) : '?'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {log.user_name || 'Desconhecido'}
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                                <span style={{ 
                                                                    fontSize: '10px', 
                                                                    padding: '1px 6px', 
                                                                    borderRadius: '4px',
                                                                    background: log.access_granted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                                    color: log.access_granted ? '#34d399' : '#f87171',
                                                                    fontWeight: 600
                                                                }}>
                                                                    {log.access_granted ? 'LIBERADO' : 'NEGADO'}
                                                                </span>
                                                                <span style={{ fontSize: '10px', color: 'var(--gray-400)' }}>
                                                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Filters */}
                                <div className="ca-logs-filters">
                                    <input
                                        type="date"
                                        className="ca-filter-input"
                                        value={logDateFrom}
                                        onChange={e => { setLogDateFrom(e.target.value); setLogsPage(0); }}
                                        title="Data inicial"
                                    />
                                    <input
                                        type="date"
                                        className="ca-filter-input"
                                        value={logDateTo}
                                        onChange={e => { setLogDateTo(e.target.value); setLogsPage(0); }}
                                        title="Data final"
                                    />
                                    <select
                                        className="ca-filter-select"
                                        value={logFilter}
                                        onChange={e => { setLogFilter(e.target.value as typeof logFilter); setLogsPage(0); }}
                                    >
                                        <option value="all">Todos os acessos</option>
                                        <option value="granted">✅ Somente liberados</option>
                                        <option value="denied">❌ Somente negados</option>
                                    </select>
                                </div>

                                {/* Table */}
                                {logsLoading ? (
                                    <div className="ca-loading">
                                        <div className="ca-spinner"></div>
                                        <p>Carregando logs...</p>
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="ca-empty-logs">
                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                        </svg>
                                        <p>Nenhum registro de acesso encontrado</p>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--gray-400)' }}>
                                            Os logs aparecerão aqui quando a catraca estiver conectada e em uso.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="ca-table-wrapper">
                                        <table className="ca-table">
                                            <thead>
                                                <tr>
                                                    <th>Horário</th>
                                                    <th>Aluno</th>
                                                    <th>Direção</th>
                                                    <th>Status</th>
                                                    <th>Motivo</th>
                                                    <th>Método</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {logs.map(log => (
                                                    <tr key={log.id}>
                                                        <td>{formatDateTime(log.created_at)}</td>
                                                        <td style={{ fontWeight: 'var(--font-weight-medium)' }}>
                                                            {log.user_name || '—'}
                                                        </td>
                                                        <td>
                                                            <span className={`ca-direction-badge ${log.direction.toLowerCase()}`}>
                                                                {log.direction === 'IN' ? (
                                                                    <>
                                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                                            <path d="M14 6l-1.41 1.41L16.17 11H4v2h12.17l-3.58 3.59L14 18l6-6z" />
                                                                        </svg>
                                                                        Entrada
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg viewBox="0 0 24 24" fill="currentColor">
                                                                            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                                                                        </svg>
                                                                        Saída
                                                                    </>
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className={`ca-access-badge ${log.access_granted ? 'granted' : 'denied'}`}>
                                                                {log.access_granted ? '✅ Liberado' : '❌ Negado'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {log.denial_reason ? (
                                                                <span className="ca-denial-reason">
                                                                    {getDenialReasonLabel(log.denial_reason)}
                                                                </span>
                                                            ) : '—'}
                                                        </td>
                                                        <td>{getMethodLabel(log.identification_method)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Pagination */}
                                        {totalPages > 1 && (
                                            <div className="ca-pagination">
                                                <span className="ca-pagination-info">
                                                    Página {logsPage + 1} de {totalPages} ({totalLogs} registros)
                                                </span>
                                                <div className="ca-pagination-buttons">
                                                    <button
                                                        className="ca-pagination-btn"
                                                        disabled={logsPage === 0}
                                                        onClick={() => setLogsPage(p => p - 1)}
                                                    >
                                                        ← Anterior
                                                    </button>
                                                    <button
                                                        className="ca-pagination-btn"
                                                        disabled={logsPage >= totalPages - 1}
                                                        onClick={() => setLogsPage(p => p + 1)}
                                                    >
                                                        Próxima →
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ==========================================
                    MODAL: Configurar Catraca
                   ========================================== */}
                {showConfigModal && (
                    <div className="ca-modal-overlay" onClick={() => setShowConfigModal(false)}>
                        <div className="ca-modal" onClick={e => e.stopPropagation()}>
                            <div className="ca-modal-header">
                                <h3>{editingConfig ? '✏️ Editar Catraca' : '➕ Nova Catraca'}</h3>
                                <button className="ca-modal-close" onClick={() => setShowConfigModal(false)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleConfigSubmit}>
                                <div className="ca-modal-body">
                                    <div className="ca-form-group">
                                        <label>Nome da Catraca</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Ex: Catraca Entrada Principal"
                                            required
                                        />
                                    </div>

                                    <div className="ca-form-row">
                                        <div className="ca-form-group">
                                            <label>Marca *</label>
                                            <select
                                                value={formData.brand}
                                                onChange={e => setFormData({ ...formData, brand: e.target.value as TurnstileBrand, model: '' })}
                                                required
                                            >
                                                <option value="">Selecione a marca</option>
                                                {TURNSTILE_BRANDS.map(b => (
                                                    <option key={b.value} value={b.value}>{b.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="ca-form-group">
                                            <label>Modelo</label>
                                            <select
                                                value={formData.model}
                                                onChange={e => setFormData({ ...formData, model: e.target.value })}
                                                disabled={!formData.brand}
                                            >
                                                <option value="">Selecione o modelo</option>
                                                {getSelectedBrandModels().map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="ca-form-row">
                                        <div className="ca-form-group">
                                            <label>Endereço IP</label>
                                            <input
                                                type="text"
                                                value={formData.ip_address}
                                                onChange={e => setFormData({ ...formData, ip_address: e.target.value })}
                                                placeholder="192.168.1.100"
                                            />
                                            <span className="ca-form-hint">IP da catraca na rede local</span>
                                        </div>

                                        <div className="ca-form-group">
                                            <label>Porta</label>
                                            <input
                                                type="number"
                                                value={formData.port}
                                                onChange={e => setFormData({ ...formData, port: e.target.value })}
                                                placeholder="80"
                                            />
                                            <span className="ca-form-hint">
                                                {formData.brand === 'TOP_DATA'
                                                    ? '⚠️ Top Data usa porta 3570 (ou deixe 0 para usar o padrão)'
                                                    : 'Padrão: 80 para Control ID e Henry, 3570 ou 0 para TopData'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="ca-form-row">
                                        <div className="ca-form-group">
                                            <label>Usuário de API</label>
                                            <input
                                                type="text"
                                                value={formData.auth_user}
                                                onChange={e => setFormData({ ...formData, auth_user: e.target.value })}
                                                placeholder="admin"
                                            />
                                            <span className="ca-form-hint">Credencial da API da catraca</span>
                                        </div>

                                        <div className="ca-form-group">
                                            <label>Senha de API</label>
                                            <input
                                                type="password"
                                                value={formData.auth_password}
                                                onChange={e => setFormData({ ...formData, auth_password: e.target.value })}
                                                placeholder="••••••"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="ca-modal-footer">
                                    <button type="button" className="ca-btn-cancel" onClick={() => setShowConfigModal(false)}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="ca-btn-save" disabled={saving}>
                                        {saving ? 'Salvando...' : editingConfig ? 'Salvar Alterações' : 'Configurar Catraca'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    MODAL: Código de Pareamento
                   ========================================== */}
                {showPairingModal && (
                    <div className="ca-modal-overlay" onClick={() => { setShowPairingModal(false); setPairingCode(null); }}>
                        <div className="ca-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                            <div className="ca-modal-header">
                                <h3>🔗 Parear Agent Local</h3>
                                <button className="ca-modal-close" onClick={() => { setShowPairingModal(false); setPairingCode(null); }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>

                            <div className="ca-modal-body" style={{ textAlign: 'center', padding: 'var(--spacing-6)' }}>
                                <p style={{ color: 'var(--gray-600)', marginBottom: 'var(--spacing-4)' }}>
                                    Catraca: <strong>{pairingConfigName}</strong>
                                </p>

                                {pairingLoading ? (
                                    <div className="ca-loading">
                                        <div className="ca-spinner"></div>
                                        <p>Gerando código...</p>
                                    </div>
                                ) : pairingCode ? (
                                    <>
                                        <div style={{
                                            background: 'var(--gray-50)',
                                            border: '2px dashed var(--primary-500)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: 'var(--spacing-5)',
                                            marginBottom: 'var(--spacing-4)'
                                        }}>
                                            <div style={{
                                                fontSize: '2rem',
                                                fontWeight: 'var(--font-weight-bold)',
                                                fontFamily: 'monospace',
                                                letterSpacing: '3px',
                                                color: 'var(--primary-700)'
                                            }}>
                                                {pairingCode}
                                            </div>
                                        </div>

                                        <button className="ca-add-btn" onClick={copyPairingCode} style={{ marginBottom: 'var(--spacing-4)' }}>
                                            📋 Copiar Código
                                        </button>

                                        <div style={{
                                            background: 'var(--warning-50)',
                                            border: '1px solid var(--warning-200)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-3)',
                                            fontSize: 'var(--font-size-sm)',
                                            color: 'var(--warning-700)'
                                        }}>
                                            ⏱️ Este código expira em <strong>10 minutos</strong>
                                        </div>

                                        <div style={{
                                            marginTop: 'var(--spacing-4)',
                                            fontSize: 'var(--font-size-sm)',
                                            color: 'var(--gray-500)',
                                            textAlign: 'left'
                                        }}>
                                            <p style={{ marginBottom: 'var(--spacing-2)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--gray-700)' }}>
                                                Como usar:
                                            </p>
                                            <ol style={{ paddingLeft: 'var(--spacing-4)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
                                                <li>Abra o <strong>PK Fit Agent</strong> no PC da academia</li>
                                                <li>Cole este código quando solicitado</li>
                                                <li>O Agent vai conectar automaticamente na catraca</li>
                                            </ol>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
