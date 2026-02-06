import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentProfessorId } from '../../../shared/services/professor.service';
import {
    getProfessorPendingRequests,
    completeWorkoutRequest,
    rejectWorkoutRequest,
    markWorkoutAsUpdated,
    type WorkoutRequest
} from '../../../shared/services/workoutRequest.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/professor.css';

const menuItems = [
    {
        label: 'Dashboard',
        path: '/professor',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
    },
    {
        label: 'Meus Alunos',
        path: '/professor/alunos',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
    },
    {
        label: 'Criar Treino',
        path: '/professor/criar-treino',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
    },
    {
        label: 'Solicitações',
        path: '/professor/solicitacoes',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" /></svg>
    }
];

export default function Solicitacoes() {
    const [requests, setRequests] = useState<WorkoutRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        const professorId = getCurrentProfessorId();
        if (professorId) {
            const result = await getProfessorPendingRequests(professorId);
            if (result.success && result.data) {
                setRequests(result.data);
            }
        }
        setIsLoading(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const getInitials = (name?: string) => {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const handleComplete = async (request: WorkoutRequest) => {
        setActionLoading(request.id);

        // Mark request as completed
        const result = await completeWorkoutRequest(request.id);

        if (result.success) {
            // Mark student's workout as updated so they see notification
            await markWorkoutAsUpdated(request.student_id);

            setMessage({ type: 'success', text: 'Solicitação marcada como atendida! O aluno será notificado.' });
            // Remove from list
            setRequests(requests.filter(r => r.id !== request.id));
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
            // Remove from list
            setRequests(requests.filter(r => r.id !== request.id));
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao rejeitar solicitação' });
        }

        setActionLoading(null);
    };

    return (
        <DashboardLayout title="Solicitações" menuItems={menuItems}>
            <div className="professor-dashboard">
                <div className="page-header">
                    <h2>Solicitações de Alteração de Treino</h2>
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
                ) : requests.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" />
                        </svg>
                        <h3>Nenhuma solicitação pendente</h3>
                        <p>Você não tem solicitações de alteração de treino aguardando resposta.</p>
                    </div>
                ) : (
                    <div className="solicitacoes-list">
                        {requests.map((request) => (
                            <div key={request.id} className="request-card">
                                <div className="request-header">
                                    <div className="request-student">
                                        <div className="user-card-avatar small">
                                            {getInitials(request.student_name)}
                                        </div>
                                        <div>
                                            <strong>{request.student_name || 'Aluno'}</strong>
                                            <span className="request-date">{formatDate(request.created_at)}</span>
                                        </div>
                                    </div>
                                    <span className="status-badge pending">Pendente</span>
                                </div>

                                <div className="request-message">
                                    <p>{request.message}</p>
                                </div>

                                <div className="request-actions">
                                    <a
                                        href={`/professor/criar-treino?studentId=${request.student_id}`}
                                        className="btn-add"
                                        style={{ marginRight: 'var(--spacing-2)' }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                        </svg>
                                        Editar Treino
                                    </a>
                                    <button
                                        className="btn-submit"
                                        onClick={() => handleComplete(request)}
                                        disabled={actionLoading === request.id}
                                    >
                                        {actionLoading === request.id ? 'Processando...' : 'Marcar como Atendida'}
                                    </button>
                                    <button
                                        className="btn-cancel"
                                        onClick={() => handleReject(request)}
                                        disabled={actionLoading === request.id}
                                        style={{ marginLeft: 'var(--spacing-2)' }}
                                    >
                                        Rejeitar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
