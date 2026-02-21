import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentAcademyId } from '../../../shared/services/academyMember.service';
import { getAcademyWorkoutRequests, type WorkoutRequest } from '../../../shared/services/workoutRequest.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../../features/adminGlobal/styles/usuarios.css';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusConfig: Record<string, { label: string; className: string; icon: string }> = {
    pending: { label: 'Pendente', className: 'pending', icon: '⏳' },
    completed: { label: 'Atendida', className: 'active', icon: '✅' },
    rejected: { label: 'Rejeitada', className: 'inactive', icon: '❌' }
};

export default function Solicitacoes() {
    const [requests, setRequests] = useState<(WorkoutRequest & { professor_name?: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');

    useEffect(() => {
        const load = async () => {
            const aId = getCurrentAcademyId();
            if (!aId) { setIsLoading(false); return; }

            const res = await getAcademyWorkoutRequests(aId);
            if (res.success && res.data) setRequests(res.data);
            setIsLoading(false);
        };
        load();
    }, []);

    const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
    const pendingCount = requests.filter(r => r.status === 'pending').length;
    const completedCount = requests.filter(r => r.status === 'completed').length;
    const rejectedCount = requests.filter(r => r.status === 'rejected').length;

    const tblStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' };
    const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--spacing-2) var(--spacing-3)', borderBottom: '2px solid var(--border-color)', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' };
    const tdStyle: React.CSSProperties = { padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border-color)' };

    return (
        <DashboardLayout title="Solicitações" menuItems={menuItems}>
            <div style={{ padding: 0 }}>
                <div style={{ marginBottom: 'var(--spacing-6)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-1)' }}>📋 Solicitações de Treino</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Acompanhe as solicitações de ficha de treino dos alunos</p>
                </div>

                {isLoading ? (
                    <div className="loading-state"><div className="spinner"></div><p>Carregando...</p></div>
                ) : requests.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" />
                        </svg>
                        <h3>Nenhuma solicitação</h3>
                        <p>Ainda não há solicitações de ficha de treino dos alunos.</p>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 'var(--spacing-6)' }}>
                            <div className="stat-card" onClick={() => setFilter('all')} style={{ cursor: 'pointer', outline: filter === 'all' ? '2px solid var(--primary-500)' : 'none', borderRadius: 'var(--radius-lg)' }}>
                                <div className="stat-icon primary">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{requests.length}</div>
                                    <div className="stat-label">Total</div>
                                </div>
                            </div>
                            <div className="stat-card" onClick={() => setFilter('pending')} style={{ cursor: 'pointer', outline: filter === 'pending' ? '2px solid var(--warning-500)' : 'none', borderRadius: 'var(--radius-lg)' }}>
                                <div className="stat-icon warning">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg>
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{pendingCount}</div>
                                    <div className="stat-label">Pendentes</div>
                                </div>
                            </div>
                            <div className="stat-card" onClick={() => setFilter('completed')} style={{ cursor: 'pointer', outline: filter === 'completed' ? '2px solid var(--success-500)' : 'none', borderRadius: 'var(--radius-lg)' }}>
                                <div className="stat-icon success">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{completedCount}</div>
                                    <div className="stat-label">Atendidas</div>
                                </div>
                            </div>
                            <div className="stat-card" onClick={() => setFilter('rejected')} style={{ cursor: 'pointer', outline: filter === 'rejected' ? '2px solid var(--error-500)' : 'none', borderRadius: 'var(--radius-lg)' }}>
                                <div className="stat-icon" style={{ background: 'var(--error-100)', color: 'var(--error-600)' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{rejectedCount}</div>
                                    <div className="stat-label">Rejeitadas</div>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                            <table style={tblStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Aluno</th>
                                        <th style={thStyle}>Professor</th>
                                        <th style={thStyle}>Mensagem</th>
                                        <th style={thStyle}>Data</th>
                                        <th style={thStyle}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--spacing-6)' }}>
                                                Nenhuma solicitação com filtro "{statusConfig[filter]?.label || 'Todos'}"
                                            </td>
                                        </tr>
                                    ) : filtered.map(req => {
                                        const sc = statusConfig[req.status] || statusConfig.pending;
                                        return (
                                            <tr key={req.id}>
                                                <td style={tdStyle}>
                                                    <div>
                                                        <strong style={{ fontSize: 'var(--font-size-sm)' }}>{req.student_name || 'Aluno'}</strong>
                                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{req.student_email}</div>
                                                    </div>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ color: 'var(--primary-600)', fontWeight: 500 }}>{req.professor_name}</span>
                                                </td>
                                                <td style={{ ...tdStyle, maxWidth: 300 }}>
                                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                                                        {req.message}
                                                    </p>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                        {formatDate(req.created_at)}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span className={`status-badge ${sc.className}`}>
                                                        {sc.icon} {sc.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {filter !== 'all' && (
                            <div style={{ textAlign: 'center', marginTop: 'var(--spacing-3)' }}>
                                <button onClick={() => setFilter('all')} style={{ background: 'none', border: 'none', color: 'var(--primary-500)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', textDecoration: 'underline' }}>
                                    Limpar filtro — ver todas
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
