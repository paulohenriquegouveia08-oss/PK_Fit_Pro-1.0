import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getProfessorStudents, getProfessorStats, getCurrentProfessorId, type ProfessorStudent } from '../../../shared/services/professor.service';
import { getProfessorPendingRequestCount } from '../../../shared/services/workoutRequest.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/usuarios.css';
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

export default function Dashboard() {
    const [stats, setStats] = useState({ studentCount: 0, workoutCount: 0, pendingRequests: 0 });
    const [students, setStudents] = useState<ProfessorStudent[]>([]);
    const [pendingRequestCount, setPendingRequestCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            const professorId = getCurrentProfessorId();
            if (professorId) {
                const [statsData, studentsResult, requestCount] = await Promise.all([
                    getProfessorStats(professorId),
                    getProfessorStudents(professorId),
                    getProfessorPendingRequestCount(professorId)
                ]);
                setStats(statsData);
                setPendingRequestCount(requestCount);
                if (studentsResult.success && studentsResult.data) {
                    setStudents(studentsResult.data);
                }
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    return (
        <DashboardLayout title="Dashboard" menuItems={menuItems}>
            <div className="professor-dashboard">
                {/* Pending Requests Notification Banner */}
                {!isLoading && pendingRequestCount > 0 && (
                    <div className="notification-banner warning-banner">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" />
                        </svg>
                        <div className="notification-content">
                            <strong>Solicitações Pendentes!</strong>
                            <p>Você tem {pendingRequestCount} {pendingRequestCount === 1 ? 'solicitação' : 'solicitações'} de alteração de treino aguardando resposta.</p>
                        </div>
                        <a href="/professor/solicitacoes" className="notification-action">Ver Solicitações</a>
                    </div>
                )}

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{isLoading ? '-' : stats.studentCount}</div>
                            <div className="stat-label">Meus Alunos</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{isLoading ? '-' : stats.workoutCount}</div>
                            <div className="stat-label">Treinos Criados</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className={`stat-icon ${pendingRequestCount > 0 ? 'warning' : 'success'}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{isLoading ? '-' : pendingRequestCount}</div>
                            <div className="stat-label">Solicitações Pendentes</div>
                        </div>
                    </div>
                </div>

                {/* Student List Section */}
                {!isLoading && students.length > 0 && (
                    <div className="dashboard-section">
                        <div className="section-header">
                            <h2 className="section-title">Meus Alunos</h2>
                            <a href="/professor/alunos" className="section-action">
                                Ver todos
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                                </svg>
                            </a>
                        </div>
                        <div className="users-grid">
                            {students.slice(0, 6).map((student) => (
                                <div key={student.id} className="user-card">
                                    <div className="user-card-avatar">
                                        {getInitials(student.name)}
                                    </div>
                                    <div className="user-card-info">
                                        <div className="user-card-name">{student.name}</div>
                                        <div className="user-card-email">{student.email}</div>
                                        <div className="user-card-meta">
                                            <span className={`status-badge ${student.has_workout ? 'active' : 'pending'}`}>
                                                {student.has_workout ? 'Com treino' : 'Sem treino'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="user-card-actions">
                                        <a href="/professor/criar-treino" className="action-btn edit" title="Criar Treino">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && students.length === 0 && (
                    <div className="dashboard-section">
                        <div className="empty-state" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                            </svg>
                            <h3>Nenhum aluno atribuído</h3>
                            <p>Você ainda não tem alunos vinculados. O administrador da academia pode atribuir alunos a você.</p>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="dashboard-section">
                        <div className="loading-state" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
                            <div className="spinner"></div>
                            <p>Carregando dados...</p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
