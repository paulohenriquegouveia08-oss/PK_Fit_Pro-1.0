import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentProfessorId } from '../../../shared/services/professor.service';
import {
    getAllProfessorRequests,
    completeWorkoutRequest,
    rejectWorkoutRequest,
    markWorkoutAsUpdated,
    type WorkoutRequest
} from '../../../shared/services/workoutRequest.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/professor.css';
import { professorMenuItems as menuItems } from '../../../shared/config/professorMenu';

type FilterTab = 'all' | 'pending' | 'completed' | 'rejected';

const tabs: { key: FilterTab; label: string; icon: string; color: string; bgColor: string }[] = [
    { key: 'all', label: 'Todas', icon: '📋', color: 'var(--primary-600)', bgColor: 'var(--primary-100)' },
    { key: 'pending', label: 'Pendentes', icon: '⏳', color: '#d97706', bgColor: '#fef3c7' },
    { key: 'completed', label: 'Atendidas', icon: '✅', color: 'var(--success-600)', bgColor: 'var(--success-100)' },
    { key: 'rejected', label: 'Rejeitadas', icon: '❌', color: 'var(--error-600)', bgColor: 'var(--error-100, #fef2f2)' },
];

export default function Solicitacoes() {
    const [allRequests, setAllRequests] = useState<WorkoutRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<FilterTab>('pending');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadRequests = async () => {
        const professorId = getCurrentProfessorId();
        if (professorId) {
            const result = await getAllProfessorRequests(professorId);
            if (result.success && result.data) {
                setAllRequests(result.data);
            }
        }
        setIsLoading(false);
    };

    useEffect(() => { loadRequests(); }, []);
    useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(t); } }, [message]);

    const formatDate = (d: string) => {
        const date = new Date(d);
        return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const getInitials = (name?: string) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const handleComplete = async (request: WorkoutRequest) => {
        setActionLoading(request.id);
        const result = await completeWorkoutRequest(request.id);
        if (result.success) {
            await markWorkoutAsUpdated(request.student_id);
            setMessage({ type: 'success', text: '✅ Solicitação marcada como atendida! O aluno será notificado.' });
            loadRequests();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao processar solicitação' });
        }
        setActionLoading(null);
    };

    const handleReject = async (request: WorkoutRequest) => {
        setActionLoading(request.id);
        const result = await rejectWorkoutRequest(request.id);
        if (result.success) {
            setMessage({ type: 'success', text: 'Solicitação rejeitada.' });
            loadRequests();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao rejeitar solicitação' });
        }
        setActionLoading(null);
    };

    // Counts
    const counts: Record<FilterTab, number> = {
        all: allRequests.length,
        pending: allRequests.filter(r => r.status === 'pending').length,
        completed: allRequests.filter(r => r.status === 'completed').length,
        rejected: allRequests.filter(r => r.status === 'rejected').length
    };

    const filtered = activeTab === 'all' ? allRequests : allRequests.filter(r => r.status === activeTab);

    const statusBadge = (status: string) => {
        const map: Record<string, { label: string; cls: string; icon: string }> = {
            pending: { label: 'Pendente', cls: 'pending', icon: '⏳' },
            completed: { label: 'Atendida', cls: 'active', icon: '✅' },
            rejected: { label: 'Rejeitada', cls: 'inactive', icon: '❌' }
        };
        const s = map[status] || map.pending;
        return <span className={`status-badge ${s.cls}`}>{s.icon} {s.label}</span>;
    };

    return (
        <DashboardLayout title="Solicitações" menuItems={menuItems}>
            <div className="professor-dashboard">
                <div className="page-header">
                    <h2>Solicitações de Treino</h2>
                </div>

                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                {isLoading ? (
                    <div className="loading-state" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                        <div className="spinner"></div>
                        <p>Carregando solicitações...</p>
                    </div>
                ) : allRequests.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" />
                        </svg>
                        <h3>Nenhuma solicitação</h3>
                        <p>Você ainda não recebeu nenhuma solicitação de ficha de treino.</p>
                    </div>
                ) : (
                    <>
                        {/* CRM-style filter tabs */}
                        <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap' }}>
                            {tabs.map(tab => {
                                const isActive = activeTab === tab.key;
                                const count = counts[tab.key];
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)',
                                            padding: 'var(--spacing-2) var(--spacing-4)',
                                            borderRadius: 'var(--radius-full)',
                                            border: isActive ? `2px solid ${tab.color}` : '2px solid var(--border-color)',
                                            background: isActive ? tab.bgColor : 'transparent',
                                            color: isActive ? tab.color : 'var(--text-secondary)',
                                            fontWeight: isActive ? 700 : 500,
                                            fontSize: 'var(--font-size-sm)',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <span>{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        <span style={{
                                            background: isActive ? tab.color : 'var(--background-tertiary)',
                                            color: isActive ? '#fff' : 'var(--text-secondary)',
                                            padding: '0 8px', borderRadius: 'var(--radius-full)',
                                            fontSize: 'var(--font-size-xs)', fontWeight: 700,
                                            minWidth: 22, textAlign: 'center', lineHeight: '20px'
                                        }}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Funnel stage description */}
                        <div style={{ marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)',
                                fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)',
                                background: 'var(--background-secondary)', padding: 'var(--spacing-1) var(--spacing-3)',
                                borderRadius: 'var(--radius-md)'
                            }}>
                                <span>Fluxo:</span>
                                <span style={{ color: '#d97706', fontWeight: 600 }}>⏳ Pendente</span>
                                <span>→</span>
                                <span style={{ color: 'var(--success-600)', fontWeight: 600 }}>✅ Atendida</span>
                                <span style={{ color: 'var(--text-secondary)' }}>ou</span>
                                <span style={{ color: 'var(--error-600)', fontWeight: 600 }}>❌ Rejeitada</span>
                            </div>
                        </div>

                        {/* Request cards */}
                        {filtered.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--text-secondary)' }}>
                                <p style={{ fontSize: 'var(--font-size-sm)' }}>
                                    Nenhuma solicitação com status "{tabs.find(t => t.key === activeTab)?.label}"
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                                {filtered.map(request => (
                                    <div key={request.id} style={{
                                        background: 'var(--background-primary, #fff)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: `1px solid ${request.status === 'pending' ? '#fbbf24' : 'var(--border-color)'}`,
                                        borderLeft: `4px solid ${request.status === 'pending' ? '#d97706' : request.status === 'completed' ? 'var(--success-500)' : 'var(--error-500)'}`,
                                        padding: 'var(--spacing-4)',
                                        transition: 'box-shadow 0.15s ease',
                                        ...(request.status === 'pending' ? { boxShadow: '0 1px 4px rgba(217, 119, 6, 0.1)' } : {})
                                    }}>
                                        {/* Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, var(--primary-500), var(--secondary-500))',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-xs)', flexShrink: 0
                                                }}>
                                                    {getInitials(request.student_name)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{request.student_name || 'Aluno'}</div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{formatDate(request.created_at)}</div>
                                                </div>
                                            </div>
                                            {statusBadge(request.status)}
                                        </div>

                                        {/* Message */}
                                        <div style={{
                                            background: 'var(--background-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-3)',
                                            marginBottom: request.status === 'pending' ? 'var(--spacing-3)' : 0,
                                            fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.5
                                        }}>
                                            "{request.message}"
                                        </div>

                                        {/* Actions (only for pending) */}
                                        {request.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                <a
                                                    href={`/professor/criar-treino?studentId=${request.student_id}`}
                                                    className="btn-add"
                                                    style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-1) var(--spacing-3)' }}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                    </svg>
                                                    Editar Treino
                                                </a>
                                                <button
                                                    className="btn-submit"
                                                    onClick={() => handleComplete(request)}
                                                    disabled={actionLoading === request.id}
                                                    style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-1) var(--spacing-3)' }}
                                                >
                                                    {actionLoading === request.id ? 'Processando...' : '✅ Marcar Atendida'}
                                                </button>
                                                <button
                                                    className="btn-cancel"
                                                    onClick={() => handleReject(request)}
                                                    disabled={actionLoading === request.id}
                                                    style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-1) var(--spacing-3)' }}
                                                >
                                                    ❌ Rejeitar
                                                </button>
                                            </div>
                                        )}

                                        {/* Updated date for completed/rejected */}
                                        {request.status !== 'pending' && request.updated_at && (
                                            <div style={{ marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textAlign: 'right' }}>
                                                {request.status === 'completed' ? '✅ Atendida' : '❌ Rejeitada'} em {formatDate(request.updated_at)}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
