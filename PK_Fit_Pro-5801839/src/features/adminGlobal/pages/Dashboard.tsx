import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getAcademies, type Academy } from '../../../shared/services/academy.service';
import { supabase } from '../../../shared/services/supabase';
import '../styles/dashboard.css';
import { adminGlobalMenuItems as menuItems } from '../../../shared/config/adminGlobalMenu';

export default function Dashboard() {
    const [stats, setStats] = useState({
        activeAcademies: 0,
        totalStudents: 0,
        monthlyRevenue: 0,
        paidPercentage: 0
    });
    const [recentAcademies, setRecentAcademies] = useState<Academy[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Academies
            const academiesResult = await getAcademies();
            const academies = academiesResult.success && academiesResult.data ? academiesResult.data : [];

            // 2. Fetch Total Students Count
            const { count: studentsCount, error: countError } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'ALUNO');

            if (countError) console.error('Error counting students:', countError);

            // 3. Calculate Stats
            const activeAcademies = academies.filter(a => a.status === 'ACTIVE').length;
            const monthlyRevenue = academies.reduce((acc, a) => {
                // Sum value of active academies or paid ones? 
                // Using active academies plan value as MRR (Monthly Recurring Revenue) projection
                return a.status === 'ACTIVE' ? acc + (a.plan_value || 0) : acc;
            }, 0);

            const paidCount = academies.filter(a => a.payment_status === 'PAID').length;
            const totalAcademies = academies.length;
            const paidPercentage = totalAcademies > 0 ? Math.round((paidCount / totalAcademies) * 100) : 0;

            setStats({
                activeAcademies,
                totalStudents: studentsCount || 0,
                monthlyRevenue,
                paidPercentage
            });

            // 4. Set Recent Academies (Top 5)
            // Assuming API returns sorted by created_at desc, otherwise sort here
            setRecentAcademies(academies.slice(0, 5));

        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'active';
            case 'INACTIVE': return 'inactive';
            case 'SUSPENDED': return 'suspended';
            default: return '';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'Ativa';
            case 'INACTIVE': return 'Inativa';
            case 'SUSPENDED': return 'Suspensa';
            default: return status;
        }
    };

    const getPaymentClass = (status: string) => {
        switch (status) {
            case 'PAID': return 'paid';
            case 'PENDING': return 'pending';
            case 'OVERDUE': return 'overdue';
            default: return '';
        }
    };

    const getPaymentLabel = (status: string) => {
        switch (status) {
            case 'PAID': return 'Em dia';
            case 'PENDING': return 'Pendente';
            case 'OVERDUE': return 'Atrasado';
            default: return status;
        }
    };

    return (
        <DashboardLayout title="Dashboard" menuItems={menuItems}>
            <div className="admin-global-dashboard">
                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {isLoading ? '...' : stats.activeAcademies}
                            </div>
                            <div className="stat-label">Academias Ativas</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {isLoading ? '...' : stats.totalStudents}
                            </div>
                            <div className="stat-label">Total de Alunos</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon warning">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {isLoading ? '...' : `R$ ${stats.monthlyRevenue.toLocaleString('pt-BR')}`}
                            </div>
                            <div className="stat-label">Receita Mensal (Estimada)</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon secondary">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {isLoading ? '...' : `${stats.paidPercentage}%`}
                            </div>
                            <div className="stat-label">Inadimplência (Pagamentos em Dia)</div>
                        </div>
                    </div>
                </div>

                {/* Recent Academies */}
                <div className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Academias Recentes</h2>
                        <a href="/admin-global/academias" className="section-action">
                            Ver todas
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                            </svg>
                        </a>
                    </div>
                    {isLoading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Carregando dados...</p>
                        </div>
                    ) : recentAcademies.length === 0 ? (
                        <div className="empty-state">
                            <p>Nenhuma academia encontrada.</p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Academia</th>
                                    <th>Status</th>
                                    <th>Pagamento</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentAcademies.map((academy) => (
                                    <tr key={academy.id}>
                                        <td>
                                            <strong>{academy.name}</strong>
                                            <br />
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                {academy.email}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${getStatusClass(academy.status)}`}>
                                                {getStatusLabel(academy.status)}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${getPaymentClass(academy.payment_status)}`}>
                                                {getPaymentLabel(academy.payment_status)}
                                            </span>
                                        </td>
                                        <td>
                                            {/* Actions removed from dashboard for simplicity, keep view only or link to details */}
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
