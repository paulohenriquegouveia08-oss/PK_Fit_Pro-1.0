import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getAcademyMembers, getCurrentAcademyId, type AcademyMember } from '../../../shared/services/academyMember.service';
import ChangePassword from '../../../shared/components/ChangePassword';
import '../../../features/adminGlobal/styles/dashboard.css';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';

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
                {/* Change Password */}
                <div className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Configurações</h2>
                    </div>
                    <div style={{ maxWidth: '500px' }}>
                        <ChangePassword />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
