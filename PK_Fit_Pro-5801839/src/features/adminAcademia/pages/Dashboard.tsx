import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getAcademyMembers, getCurrentAcademyId, type AcademyMember } from '../../../shared/services/academyMember.service';
import '../../../features/adminGlobal/styles/dashboard.css';

const menuItems = [
    {
        label: 'Dashboard',
        path: '/admin-academia',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
    },
    {
        label: 'Professores',
        path: '/admin-academia/professores',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" /></svg>
    },
    {
        label: 'Alunos',
        path: '/admin-academia/alunos',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
    },
    {
        label: 'Planos',
        path: '/admin-academia/planos',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" /></svg>
    },
    {
        label: 'Financeiro',
        path: '/admin-academia/financeiro',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" /></svg>
    }
];

export default function Dashboard() {
    const [professors, setProfessors] = useState<AcademyMember[]>([]);
    const [studentCount, setStudentCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            const academyId = getCurrentAcademyId();
            if (academyId) {
                const [profsResult, studentsResult] = await Promise.all([
                    getAcademyMembers(academyId, 'PROFESSOR'),
                    getAcademyMembers(academyId, 'ALUNO')
                ]);

                if (profsResult.success && profsResult.data) {
                    setProfessors(profsResult.data);
                }
                if (studentsResult.success && studentsResult.data) {
                    setStudentCount(studentsResult.data.length);
                }
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    return (
        <DashboardLayout title="Dashboard" menuItems={menuItems}>
            <div className="admin-global-dashboard">
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{isLoading ? '-' : professors.length}</div>
                            <div className="stat-label">Professores</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{isLoading ? '-' : studentCount}</div>
                            <div className="stat-label">Alunos Ativos</div>
                        </div>
                    </div>
                </div>

                {professors.length > 0 && (
                    <div className="dashboard-section">
                        <div className="section-header">
                            <h2 className="section-title">Professores</h2>
                            <a href="/admin-academia/professores" className="section-action">
                                Ver todos
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                                </svg>
                            </a>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Professor</th>
                                    <th>Alunos</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {professors.slice(0, 5).map((prof) => (
                                    <tr key={prof.id}>
                                        <td>
                                            <strong>{prof.name}</strong><br />
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{prof.email}</span>
                                        </td>
                                        <td>{prof.student_count || 0}</td>
                                        <td>
                                            <span className={`status-badge ${prof.is_active ? 'active' : 'inactive'}`}>
                                                {prof.is_active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {professors.length === 0 && studentCount === 0 && !isLoading && (
                    <div className="dashboard-section">
                        <div className="empty-state" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                            </svg>
                            <h3>Comece a configurar sua academia</h3>
                            <p>Adicione professores e alunos para começar a usar o sistema.</p>
                            <div style={{ marginTop: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'center' }}>
                                <a href="/admin-academia/professores" className="btn-add">Adicionar Professor</a>
                                <a href="/admin-academia/alunos" className="btn-add" style={{ background: 'var(--success-500)' }}>Adicionar Aluno</a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
