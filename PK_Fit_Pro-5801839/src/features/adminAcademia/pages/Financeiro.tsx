import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentAcademyId } from '../../../shared/services/academyMember.service';
import {
    getFinancialSummary,
    getChartData,
    getPlanDistribution,
    getActivePlanCount,
    getPaidUnpaidCounts,
    getPaymentDetailsForPeriod,
    getExpenseDetailsForPeriod,
    getPlanStudentsDetail,
    getActivePlansWithRevenue,
    getPaidStudents,
    getUnpaidStudents,
    createExpense,
    type GroupBy
} from '../../../shared/services/financial.service';
import type {
    FinancialSummary, ChartDataPoint, PlanDistribution,
    PaidUnpaidCounts, PaymentDetail, ExpenseDetail,
    StudentPlanDetail, PlanWithRevenue, PaidUnpaidStudent
} from '../../../shared/types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../../features/adminGlobal/styles/usuarios.css';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';

function getDefaultDateRange() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: fmt(firstDay), end: fmt(lastDay) };
}

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const formatDate = (d: string) => { const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: 'var(--background-primary,#fff)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-3)', boxShadow: 'var(--shadow-lg)' }}>
                <p style={{ fontWeight: 600, marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)' }}>{label}</p>
                {payload.map((p: any, i: number) => (
                    <p key={i} style={{ color: p.color, fontSize: 'var(--font-size-sm)' }}>{p.name}: {formatCurrency(p.value)}</p>
                ))}
            </div>
        );
    }
    return null;
};

// Modal wrapper
const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={wide ? { maxWidth: '900px', width: '95%' } : {}}>
            <div className="modal-header">
                <h3 className="modal-title">{title}</h3>
                <button className="modal-close" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>{children}</div>
        </div>
    </div>
);

export default function Financeiro() {
    const defaults = getDefaultDateRange();
    const [startDate, setStartDate] = useState(defaults.start);
    const [endDate, setEndDate] = useState(defaults.end);
    const [groupBy, setGroupBy] = useState<GroupBy>('monthly');
    const [isLoading, setIsLoading] = useState(true);
    const [academyId, setAcademyId] = useState<string | null>(null);

    // Main data
    const [summary, setSummary] = useState<FinancialSummary>({ totalRevenue: 0, totalExpenses: 0, netProfit: 0 });
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [planDist, setPlanDist] = useState<PlanDistribution[]>([]);
    const [activePlans, setActivePlans] = useState(0);
    const [paidUnpaid, setPaidUnpaid] = useState<PaidUnpaidCounts>({ paid: 0, unpaid: 0 });

    // Drill-down modals
    const [showPlansModal, setShowPlansModal] = useState(false);
    const [showRevenueModal, setShowRevenueModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showPlanStudentsModal, setShowPlanStudentsModal] = useState(false);
    const [showStudentsModal, setShowStudentsModal] = useState(false);
    const [, setSelectedPlanId] = useState<string | null>(null);
    const [selectedPlanName, setSelectedPlanName] = useState('');

    // Drill-down data
    const [plansWithRevenue, setPlansWithRevenue] = useState<PlanWithRevenue[]>([]);
    const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
    const [expenseDetails, setExpenseDetails] = useState<ExpenseDetail[]>([]);
    const [planStudents, setPlanStudents] = useState<StudentPlanDetail[]>([]);
    const [paidStudentsList, setPaidStudentsList] = useState<PaidUnpaidStudent[]>([]);
    const [unpaidStudentsList, setUnpaidStudentsList] = useState<PaidUnpaidStudent[]>([]);
    const [studentsTab, setStudentsTab] = useState<'paid' | 'unpaid'>('paid');
    const [modalLoading, setModalLoading] = useState(false);

    // Expense form
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [expenseForm, setExpenseForm] = useState({ description: '', category: '', amount: '', expense_date: new Date().toISOString().split('T')[0] });
    const [expenseSubmitting, setExpenseSubmitting] = useState(false);
    const [expenseMsg, setExpenseMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadData = async (acaId: string, start: string, end: string, group: GroupBy) => {
        setIsLoading(true);
        const [summaryRes, chartRes, distRes, plansRes, puRes] = await Promise.all([
            getFinancialSummary(acaId, start, end),
            getChartData(acaId, start, end, group),
            getPlanDistribution(acaId),
            getActivePlanCount(acaId),
            getPaidUnpaidCounts(acaId)
        ]);
        if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
        if (chartRes.success && chartRes.data) setChartData(chartRes.data);
        if (distRes.success && distRes.data) setPlanDist(distRes.data);
        if (plansRes.success && plansRes.data !== undefined) setActivePlans(plansRes.data);
        if (puRes.success && puRes.data) setPaidUnpaid(puRes.data);
        setIsLoading(false);
    };

    useEffect(() => {
        const acaId = getCurrentAcademyId();
        if (acaId) { setAcademyId(acaId); loadData(acaId, startDate, endDate, groupBy); }
        else setIsLoading(false);
    }, []);

    const handleFilter = () => {
        if (!academyId) return;
        if (endDate < startDate) { alert('Data final deve ser maior ou igual à data inicial.'); return; }
        loadData(academyId, startDate, endDate, groupBy);
    };

    const handleGroupByChange = (g: GroupBy) => {
        setGroupBy(g);
        if (academyId) loadData(academyId, startDate, endDate, g);
    };

    // Drill-down handlers
    const openPlansModal = async () => {
        if (!academyId) return;
        setModalLoading(true); setShowPlansModal(true);
        const res = await getActivePlansWithRevenue(academyId);
        if (res.success && res.data) setPlansWithRevenue(res.data);
        setModalLoading(false);
    };

    const openRevenueModal = async () => {
        if (!academyId) return;
        setModalLoading(true); setShowRevenueModal(true);
        const res = await getPaymentDetailsForPeriod(academyId, startDate, endDate);
        if (res.success && res.data) setPaymentDetails(res.data);
        setModalLoading(false);
    };

    const openExpenseModal = async () => {
        if (!academyId) return;
        setModalLoading(true); setShowExpenseModal(true);
        const res = await getExpenseDetailsForPeriod(academyId, startDate, endDate);
        if (res.success && res.data) setExpenseDetails(res.data);
        setModalLoading(false);
    };

    const openPlanStudentsModal = async (planId: string, planName: string) => {
        if (!academyId) return;
        setSelectedPlanId(planId); setSelectedPlanName(planName);
        setModalLoading(true); setShowPlanStudentsModal(true);
        const res = await getPlanStudentsDetail(planId, academyId);
        if (res.success && res.data) setPlanStudents(res.data);
        setModalLoading(false);
    };

    const openStudentsModal = async (tab: 'paid' | 'unpaid') => {
        if (!academyId) return;
        setStudentsTab(tab); setModalLoading(true); setShowStudentsModal(true);
        const [paidRes, unpaidRes] = await Promise.all([
            getPaidStudents(academyId), getUnpaidStudents(academyId)
        ]);
        if (paidRes.success && paidRes.data) setPaidStudentsList(paidRes.data);
        if (unpaidRes.success && unpaidRes.data) setUnpaidStudentsList(unpaidRes.data);
        setModalLoading(false);
    };

    // Table style
    const tblStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' };
    const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--spacing-2) var(--spacing-3)', borderBottom: '2px solid var(--border-color)', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' };
    const tdStyle: React.CSSProperties = { padding: 'var(--spacing-2) var(--spacing-3)', borderBottom: '1px solid var(--border-color)' };

    return (
        <DashboardLayout title="Financeiro" menuItems={menuItems}>
            <div style={{ padding: 0 }}>
                {/* Filter Bar */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)', alignItems: 'flex-end', marginBottom: 'var(--spacing-6)', padding: 'var(--spacing-4)', background: 'var(--background-secondary,#f9fafb)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--spacing-1)' }}>📅 Data Início</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: 'var(--spacing-2) var(--spacing-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-sm)', background: 'var(--background-primary,#fff)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--spacing-1)' }}>📅 Data Fim</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: 'var(--spacing-2) var(--spacing-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-sm)', background: 'var(--background-primary,#fff)' }} />
                    </div>
                    <button onClick={handleFilter} style={{ padding: 'var(--spacing-2) var(--spacing-6)', background: 'var(--primary-500)', color: '#fff', borderRadius: 'var(--radius-md)', border: 'none', fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer', height: '38px' }}>Aplicar</button>
                </div>

                {isLoading ? (
                    <div className="loading-state"><div className="spinner"></div><p>Carregando dados financeiros...</p></div>
                ) : !academyId ? (
                    <div className="empty-state"><h3>Academia não identificada</h3><p>Faça login novamente.</p></div>
                ) : (
                    <>
                        {/* SEÇÃO 1: RESUMO DE PLANOS */}
                        <div style={{ marginBottom: 'var(--spacing-6)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                📋 Resumo de Planos
                            </h3>
                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                                {/* Planos Ativos - clickable */}
                                <div className="stat-card" style={{ cursor: 'pointer' }} onClick={openPlansModal}>
                                    <div className="stat-icon primary">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z" /></svg>
                                    </div>
                                    <div className="stat-content">
                                        <div className="stat-value">{activePlans}</div>
                                        <div className="stat-label">Planos Ativos</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--primary-500)', marginTop: 2 }}>Clique para detalhes →</div>
                                    </div>
                                </div>

                                {/* Pagos - clickable */}
                                <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '4px solid var(--success-500)' }} onClick={() => openStudentsModal('paid')}>
                                    <div className="stat-icon" style={{ background: 'var(--success-100)', color: 'var(--success-600)' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                                    </div>
                                    <div className="stat-content">
                                        <div className="stat-value" style={{ color: 'var(--success-600)' }}>{paidUnpaid.paid}</div>
                                        <div className="stat-label">🟢 Planos Pagos</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success-500)', marginTop: 2 }}>Ver alunos →</div>
                                    </div>
                                </div>

                                {/* Não Pagos - clickable */}
                                <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '4px solid var(--error-500)' }} onClick={() => openStudentsModal('unpaid')}>
                                    <div className="stat-icon" style={{ background: 'var(--error-100)', color: 'var(--error-600)' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                                    </div>
                                    <div className="stat-content">
                                        <div className="stat-value" style={{ color: 'var(--error-600)' }}>{paidUnpaid.unpaid}</div>
                                        <div className="stat-label">🔴 Planos Não Pagos</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--error-500)', marginTop: 2 }}>Ver alunos →</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 2: RESUMO FINANCEIRO */}
                        <div style={{ marginBottom: 'var(--spacing-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', margin: 0 }}>
                                    💰 Resumo Financeiro
                                </h3>
                                <button onClick={() => { setShowExpenseForm(true); setExpenseMsg(null); }} style={{ padding: 'var(--spacing-2) var(--spacing-4)', background: 'var(--error-500)', color: '#fff', borderRadius: 'var(--radius-md)', border: 'none', fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                                    Nova Despesa
                                </button>
                            </div>
                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                                {/* Total Faturado - clickable */}
                                <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '4px solid var(--success-500)' }} onClick={openRevenueModal}>
                                    <div className="stat-icon" style={{ background: 'var(--success-100)', color: 'var(--success-600)' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z" /></svg>
                                    </div>
                                    <div className="stat-content">
                                        <div className="stat-value" style={{ color: 'var(--success-600)' }}>{formatCurrency(summary.totalRevenue)}</div>
                                        <div className="stat-label">Total Faturado</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success-500)', marginTop: 2 }}>Ver detalhes →</div>
                                    </div>
                                </div>

                                {/* Total Despesas - clickable */}
                                <div className="stat-card" style={{ cursor: 'pointer', borderLeft: '4px solid var(--error-500)' }} onClick={openExpenseModal}>
                                    <div className="stat-icon" style={{ background: 'var(--error-100)', color: 'var(--error-600)' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 11v2h10v-2H7zm5-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /></svg>
                                    </div>
                                    <div className="stat-content">
                                        <div className="stat-value" style={{ color: 'var(--error-600)' }}>{formatCurrency(summary.totalExpenses)}</div>
                                        <div className="stat-label">Total de Despesas</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--error-500)', marginTop: 2 }}>Ver detalhes →</div>
                                    </div>
                                </div>

                                {/* Lucro Líquido */}
                                <div className="stat-card" style={{ borderLeft: `4px solid ${summary.netProfit >= 0 ? 'var(--secondary-500)' : 'var(--error-500)'}` }}>
                                    <div className="stat-icon" style={{ background: summary.netProfit >= 0 ? 'var(--secondary-100)' : 'var(--error-100)', color: summary.netProfit >= 0 ? 'var(--secondary-600)' : 'var(--error-600)' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" /></svg>
                                    </div>
                                    <div className="stat-content">
                                        <div className="stat-value" style={{ color: summary.netProfit >= 0 ? 'var(--secondary-600)' : 'var(--error-600)' }}>{formatCurrency(summary.netProfit)}</div>
                                        <div className="stat-label">Lucro Líquido</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 3: TABELA DISTRIBUIÇÃO POR PLANO */}
                        <div style={{ marginBottom: 'var(--spacing-6)' }}>
                            <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-4)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                📊 Distribuição por Plano
                            </h3>
                            {planDist.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--text-secondary)', background: 'var(--background-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                                    Nenhum plano ativo cadastrado
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                                    <table style={tblStyle}>
                                        <thead>
                                            <tr><th style={thStyle}>Nome do Plano</th><th style={thStyle}>Duração</th><th style={thStyle}>Valor</th><th style={thStyle}>Alunos</th></tr>
                                        </thead>
                                        <tbody>
                                            {planDist.map(plan => (
                                                <tr key={plan.id} onClick={() => openPlanStudentsModal(plan.id, plan.name)} style={{ cursor: 'pointer', transition: 'var(--transition-fast)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--background-secondary)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                                    <td style={tdStyle}><strong style={{ color: 'var(--primary-600)' }}>{plan.name}</strong></td>
                                                    <td style={tdStyle}>{plan.duration_in_months} {plan.duration_in_months === 1 ? 'mês' : 'meses'}</td>
                                                    <td style={{ ...tdStyle, color: 'var(--success-600)', fontWeight: 600 }}>{formatCurrency(plan.price)}</td>
                                                    <td style={tdStyle}>
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: plan.student_count > 0 ? 'var(--primary-100)' : 'var(--gray-100)', color: plan.student_count > 0 ? 'var(--primary-700)' : 'var(--gray-500)', borderRadius: 'var(--radius-full)', padding: '2px 12px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{plan.student_count}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* SEÇÃO 4: GRÁFICO */}
                        <div style={{ marginBottom: 'var(--spacing-6)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', margin: 0 }}>📈 Receita vs Despesa</h3>
                                <div style={{ display: 'flex', gap: '2px', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                                    {([{ v: 'daily' as GroupBy, l: 'Diário' }, { v: 'monthly' as GroupBy, l: 'Mensal' }, { v: 'yearly' as GroupBy, l: 'Anual' }]).map(opt => (
                                        <button key={opt.v} onClick={() => handleGroupByChange(opt.v)} style={{ padding: 'var(--spacing-1) var(--spacing-3)', borderRadius: 'var(--radius-sm)', border: 'none', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer', background: groupBy === opt.v ? 'var(--primary-500)' : 'transparent', color: groupBy === opt.v ? '#fff' : 'var(--text-secondary)', transition: 'var(--transition-fast)' }}>{opt.l}</button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ background: 'var(--background-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 'var(--spacing-4)' }}>
                                {chartData.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 'var(--spacing-10)', color: 'var(--text-secondary)' }}>
                                        <p>Nenhum dado encontrado para o período selecionado</p>
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart data={chartData} barGap={4} barCategoryGap="20%">
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                                            <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                                            <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                                            <Bar dataKey="revenue" name="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* ===== MODALS ===== */}

                        {/* Modal: Planos Ativos com Faturamento */}
                        {showPlansModal && (
                            <Modal title="Planos Ativos — Detalhamento" onClose={() => setShowPlansModal(false)} wide>
                                {modalLoading ? <div className="loading-state"><div className="spinner"></div></div> : (
                                    <table style={tblStyle}>
                                        <thead><tr><th style={thStyle}>Plano</th><th style={thStyle}>Duração</th><th style={thStyle}>Valor</th><th style={thStyle}>Alunos</th><th style={thStyle}>Total Faturado</th></tr></thead>
                                        <tbody>
                                            {plansWithRevenue.map(p => (
                                                <tr key={p.id}><td style={tdStyle}><strong>{p.name}</strong></td><td style={tdStyle}>{p.duration_in_months} {p.duration_in_months === 1 ? 'mês' : 'meses'}</td><td style={{ ...tdStyle, fontWeight: 600 }}>{formatCurrency(p.price)}</td><td style={tdStyle}>{p.student_count}</td><td style={{ ...tdStyle, color: 'var(--success-600)', fontWeight: 600 }}>{formatCurrency(p.total_revenue)}</td></tr>
                                            ))}
                                            {plansWithRevenue.length === 0 && <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum plano ativo</td></tr>}
                                        </tbody>
                                    </table>
                                )}
                            </Modal>
                        )}

                        {/* Modal: Detalhes de Faturamento */}
                        {showRevenueModal && (
                            <Modal title="Detalhes do Faturamento" onClose={() => setShowRevenueModal(false)} wide>
                                {modalLoading ? <div className="loading-state"><div className="spinner"></div></div> : (
                                    <>
                                        <div style={{ padding: 'var(--spacing-3)', background: 'var(--success-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-3)', textAlign: 'center' }}>
                                            <strong style={{ color: 'var(--success-700)' }}>Total: {formatCurrency(paymentDetails.reduce((s, p) => s + p.amount, 0))}</strong>
                                        </div>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={tblStyle}>
                                                <thead><tr><th style={thStyle}>Data</th><th style={thStyle}>Aluno</th><th style={thStyle}>Plano</th><th style={thStyle}>Forma de Pgto.</th><th style={thStyle}>Valor</th></tr></thead>
                                                <tbody>
                                                    {paymentDetails.map(p => (
                                                        <tr key={p.id}>
                                                            <td style={tdStyle}>{formatDate(p.payment_date)}</td>
                                                            <td style={tdStyle}>{p.student_name || '—'}</td>
                                                            <td style={tdStyle}>{p.plan_name || '—'}</td>
                                                            <td style={tdStyle}>
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 500,
                                                                    background: 'var(--gray-100)',
                                                                    color: 'var(--gray-700)',
                                                                    textTransform: 'capitalize'
                                                                }}>
                                                                    {p.payment_method || 'N/I'}
                                                                </span>
                                                            </td>
                                                            <td style={{ ...tdStyle, color: 'var(--success-600)', fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                                                        </tr>
                                                    ))}
                                                    {paymentDetails.length === 0 && <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum pagamento no período</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </Modal>
                        )}

                        {/* Modal: Detalhes de Despesas */}
                        {showExpenseModal && (
                            <Modal title="Detalhes das Despesas" onClose={() => setShowExpenseModal(false)} wide>
                                {modalLoading ? <div className="loading-state"><div className="spinner"></div></div> : (
                                    <>
                                        <div style={{ padding: 'var(--spacing-3)', background: 'var(--error-50)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-3)', textAlign: 'center' }}>
                                            <strong style={{ color: 'var(--error-700)' }}>Total: {formatCurrency(expenseDetails.reduce((s, e) => s + e.amount, 0))}</strong>
                                        </div>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={tblStyle}>
                                                <thead><tr><th style={thStyle}>Data</th><th style={thStyle}>Descrição</th><th style={thStyle}>Categoria</th><th style={thStyle}>Valor</th></tr></thead>
                                                <tbody>
                                                    {expenseDetails.map(e => (
                                                        <tr key={e.id}><td style={tdStyle}>{formatDate(e.expense_date)}</td><td style={tdStyle}>{e.description}</td><td style={tdStyle}>{e.category || '—'}</td><td style={{ ...tdStyle, color: 'var(--error-600)', fontWeight: 600 }}>{formatCurrency(e.amount)}</td></tr>
                                                    ))}
                                                    {expenseDetails.length === 0 && <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhuma despesa no período</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </Modal>
                        )}

                        {/* Modal: Alunos do Plano */}
                        {showPlanStudentsModal && (
                            <Modal title={`Alunos — ${selectedPlanName}`} onClose={() => { setShowPlanStudentsModal(false); setSelectedPlanId(null); }} wide>
                                {modalLoading ? <div className="loading-state"><div className="spinner"></div></div> : (
                                    <table style={tblStyle}>
                                        <thead><tr><th style={thStyle}>Aluno</th><th style={thStyle}>Início</th><th style={thStyle}>Término</th><th style={thStyle}>Valor</th><th style={thStyle}>Pagamento</th></tr></thead>
                                        <tbody>
                                            {planStudents.map(s => (
                                                <tr key={s.student_id}>
                                                    <td style={tdStyle}><strong>{s.student_name}</strong></td>
                                                    <td style={tdStyle}>{formatDate(s.plan_start_date)}</td>
                                                    <td style={tdStyle}>{formatDate(s.plan_end_date)}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{formatCurrency(s.plan_price)}</td>
                                                    <td style={tdStyle}>
                                                        <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, background: s.payment_status === 'pago' ? 'var(--success-100)' : 'var(--error-100)', color: s.payment_status === 'pago' ? 'var(--success-700)' : 'var(--error-700)' }}>
                                                            {s.payment_status === 'pago' ? '✅ Pago' : '❌ Não Pago'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {planStudents.length === 0 && <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum aluno vinculado</td></tr>}
                                        </tbody>
                                    </table>
                                )}
                            </Modal>
                        )}

                        {/* Modal: Alunos Pagos / Não Pagos */}
                        {showStudentsModal && (
                            <Modal title="Alunos — Pagos e Não Pagos" onClose={() => setShowStudentsModal(false)} wide>
                                {/* Tabs */}
                                <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--spacing-4)', borderBottom: '2px solid var(--border-color)' }}>
                                    <button onClick={() => setStudentsTab('paid')} style={{ flex: 1, padding: 'var(--spacing-2) var(--spacing-4)', border: 'none', borderBottom: studentsTab === 'paid' ? '3px solid var(--success-500)' : '3px solid transparent', background: 'transparent', fontWeight: 600, fontSize: 'var(--font-size-sm)', cursor: 'pointer', color: studentsTab === 'paid' ? 'var(--success-600)' : 'var(--text-secondary)' }}>
                                        🟢 Pagos ({paidStudentsList.length})
                                    </button>
                                    <button onClick={() => setStudentsTab('unpaid')} style={{ flex: 1, padding: 'var(--spacing-2) var(--spacing-4)', border: 'none', borderBottom: studentsTab === 'unpaid' ? '3px solid var(--error-500)' : '3px solid transparent', background: 'transparent', fontWeight: 600, fontSize: 'var(--font-size-sm)', cursor: 'pointer', color: studentsTab === 'unpaid' ? 'var(--error-600)' : 'var(--text-secondary)' }}>
                                        🔴 Não Pagos ({unpaidStudentsList.length})
                                    </button>
                                </div>
                                {modalLoading ? <div className="loading-state"><div className="spinner"></div></div> : (
                                    <table style={tblStyle}>
                                        <thead><tr><th style={thStyle}>Nome</th><th style={thStyle}>Email</th><th style={thStyle}>Plano</th><th style={thStyle}>Valor</th>{studentsTab === 'paid' && <th style={thStyle}>Data Pgto</th>}</tr></thead>
                                        <tbody>
                                            {(studentsTab === 'paid' ? paidStudentsList : unpaidStudentsList).map(s => (
                                                <tr key={s.id}>
                                                    <td style={tdStyle}><strong>{s.name}</strong></td>
                                                    <td style={tdStyle}>{s.email}</td>
                                                    <td style={tdStyle}>{s.plan_name || '—'}</td>
                                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{s.plan_price ? formatCurrency(s.plan_price) : '—'}</td>
                                                    {studentsTab === 'paid' && <td style={tdStyle}>{s.payment_date ? formatDate(s.payment_date) : '—'}</td>}
                                                </tr>
                                            ))}
                                            {(studentsTab === 'paid' ? paidStudentsList : unpaidStudentsList).length === 0 && (
                                                <tr><td colSpan={studentsTab === 'paid' ? 5 : 4} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)' }}>Nenhum aluno encontrado</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </Modal>
                        )}

                        {/* Modal: Nova Despesa */}
                        {showExpenseForm && (
                            <Modal title="Nova Despesa" onClose={() => setShowExpenseForm(false)}>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!academyId) return;
                                    setExpenseSubmitting(true);
                                    setExpenseMsg(null);
                                    const res = await createExpense({
                                        academy_id: academyId,
                                        description: expenseForm.description,
                                        category: expenseForm.category || undefined,
                                        amount: parseFloat(expenseForm.amount),
                                        expense_date: expenseForm.expense_date
                                    });
                                    if (res.success) {
                                        setExpenseMsg({ type: 'success', text: 'Despesa registrada com sucesso!' });
                                        setExpenseForm({ description: '', category: '', amount: '', expense_date: new Date().toISOString().split('T')[0] });
                                        loadData(academyId, startDate, endDate, groupBy);
                                        setTimeout(() => setShowExpenseForm(false), 1000);
                                    } else {
                                        setExpenseMsg({ type: 'error', text: res.error || 'Erro ao registrar despesa' });
                                    }
                                    setExpenseSubmitting(false);
                                }}>
                                    {expenseMsg && (
                                        <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-3)', background: expenseMsg.type === 'success' ? 'var(--success-50)' : 'var(--error-50)', color: expenseMsg.type === 'success' ? 'var(--success-700)' : 'var(--error-700)', fontSize: 'var(--font-size-sm)' }}>
                                            {expenseMsg.text}
                                        </div>
                                    )}
                                    <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                                        <label className="form-label">Descrição *</label>
                                        <input className="form-input" type="text" required placeholder="Ex: Conta de luz" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 'var(--spacing-3)' }}>
                                        <label className="form-label">Categoria</label>
                                        <select className="form-input" value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}>
                                            <option value="">Selecione (opcional)</option>
                                            <option value="Aluguel">Aluguel</option>
                                            <option value="Energia">Energia</option>
                                            <option value="Água">Água</option>
                                            <option value="Internet">Internet</option>
                                            <option value="Equipamentos">Equipamentos</option>
                                            <option value="Manutenção">Manutenção</option>
                                            <option value="Salários">Salários</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Limpeza">Limpeza</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                                        <div className="form-group" style={{ flex: 1, marginBottom: 'var(--spacing-3)' }}>
                                            <label className="form-label">Valor (R$) *</label>
                                            <input className="form-input" type="number" step="0.01" min="0.01" required placeholder="0,00" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
                                        </div>
                                        <div className="form-group" style={{ flex: 1, marginBottom: 'var(--spacing-3)' }}>
                                            <label className="form-label">Data *</label>
                                            <input className="form-input" type="date" required value={expenseForm.expense_date} onChange={e => setExpenseForm(f => ({ ...f, expense_date: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end', marginTop: 'var(--spacing-3)' }}>
                                        <button type="button" onClick={() => setShowExpenseForm(false)} style={{ padding: 'var(--spacing-2) var(--spacing-4)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'transparent', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>Cancelar</button>
                                        <button type="submit" disabled={expenseSubmitting} style={{ padding: 'var(--spacing-2) var(--spacing-4)', background: 'var(--error-500)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)', opacity: expenseSubmitting ? 0.7 : 1 }}>
                                            {expenseSubmitting ? 'Salvando...' : 'Registrar Despesa'}
                                        </button>
                                    </div>
                                </form>
                            </Modal>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}
