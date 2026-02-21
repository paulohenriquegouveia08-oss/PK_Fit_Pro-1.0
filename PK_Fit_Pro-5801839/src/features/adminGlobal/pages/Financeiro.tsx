import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import {
    getAcademies,
    updateAcademy,
    updateAcademyStatus,
    type Academy
} from '../../../shared/services/academy.service';
import '../styles/dashboard.css';
import '../styles/academias.css';
import '../styles/financeiro.css';
import { adminGlobalMenuItems as menuItems } from '../../../shared/config/adminGlobalMenu';

export default function Financeiro() {
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Load academies
    const loadAcademies = async () => {
        setIsLoading(true);
        const result = await getAcademies();
        if (result.success && result.data) {
            setAcademies(result.data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadAcademies();
    }, []);

    // Filter academies by payment status
    const filteredAcademies = academies.filter(academy =>
        filterStatus === 'all' || academy.payment_status === filterStatus
    );

    // Calculate totals
    const totalReceita = academies.reduce((acc, a) =>
        a.payment_status === 'PAID' ? acc + (a.plan_value || 0) : acc, 0
    );
    const totalPendente = academies.reduce((acc, a) =>
        a.payment_status === 'PENDING' ? acc + (a.plan_value || 0) : acc, 0
    );
    const totalAtrasado = academies.reduce((acc, a) =>
        a.payment_status === 'OVERDUE' ? acc + (a.plan_value || 0) : acc, 0
    );

    // Confirm payment
    const handleConfirmPayment = async (academy: Academy) => {
        setProcessingId(academy.id);

        const result = await updateAcademy(academy.id, {
            payment_status: 'PAID',
            status: 'ACTIVE' // Reactivate if suspended
        });

        if (result.success) {
            setMessage({ type: 'success', text: `Pagamento de ${academy.name} confirmado!` });
            loadAcademies();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao confirmar pagamento' });
        }

        setProcessingId(null);
    };

    // Suspend academy for non-payment
    const handleSuspend = async (academy: Academy) => {
        setProcessingId(academy.id);

        const result = await updateAcademyStatus(academy.id, 'SUSPENDED');

        if (result.success) {
            setMessage({ type: 'success', text: `${academy.name} suspensa por inadimplência` });
            loadAcademies();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao suspender academia' });
        }

        setProcessingId(null);
    };

    // Mark as overdue
    const handleMarkOverdue = async (academy: Academy) => {
        setProcessingId(academy.id);

        const result = await updateAcademy(academy.id, { payment_status: 'OVERDUE' });

        if (result.success) {
            setMessage({ type: 'success', text: `${academy.name} marcada como atrasada` });
            loadAcademies();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar status' });
        }

        setProcessingId(null);
    };

    // Reactivate academy
    const handleReactivate = async (academy: Academy) => {
        setProcessingId(academy.id);

        const result = await updateAcademy(academy.id, {
            status: 'ACTIVE',
            payment_status: 'PAID'
        });

        if (result.success) {
            setMessage({ type: 'success', text: `${academy.name} reativada com sucesso!` });
            loadAcademies();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao reativar academia' });
        }

        setProcessingId(null);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR');
    };

    const getPaymentStatusLabel = (status: string) => {
        switch (status) {
            case 'PAID': return 'Pago';
            case 'PENDING': return 'Pendente';
            case 'OVERDUE': return 'Atrasado';
            default: return status;
        }
    };

    const getPaymentStatusClass = (status: string) => {
        switch (status) {
            case 'PAID': return 'paid';
            case 'PENDING': return 'pending';
            case 'OVERDUE': return 'overdue';
            default: return '';
        }
    };

    // Auto-hide message
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    return (
        <DashboardLayout title="Financeiro" menuItems={menuItems}>
            <div className="financeiro-page">
                {/* Message Toast */}
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="finance-summary">
                    <div className="finance-card">
                        <div className="finance-card-header">
                            <div className="finance-card-icon success">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                            </div>
                        </div>
                        <div className="finance-card-value">R$ {totalReceita.toLocaleString('pt-BR')}</div>
                        <div className="finance-card-label">Recebido este mês</div>
                    </div>

                    <div className="finance-card">
                        <div className="finance-card-header">
                            <div className="finance-card-icon warning">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                </svg>
                            </div>
                        </div>
                        <div className="finance-card-value">R$ {totalPendente.toLocaleString('pt-BR')}</div>
                        <div className="finance-card-label">Pagamentos pendentes</div>
                    </div>

                    <div className="finance-card">
                        <div className="finance-card-header">
                            <div className="finance-card-icon error">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
                                </svg>
                            </div>
                        </div>
                        <div className="finance-card-value">R$ {totalAtrasado.toLocaleString('pt-BR')}</div>
                        <div className="finance-card-label">Pagamentos atrasados</div>
                    </div>

                    <div className="finance-card">
                        <div className="finance-card-header">
                            <div className="finance-card-icon primary">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                </svg>
                            </div>
                        </div>
                        <div className="finance-card-value">{academies.length}</div>
                        <div className="finance-card-label">Total de academias</div>
                    </div>
                </div>

                <div className="payments-section">
                    <div className="payments-header">
                        <h3 className="payments-title">Pagamentos das Academias</h3>
                        <div className="payments-filters">
                            <select
                                className="filter-select"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="all">Todos</option>
                                <option value="PAID">Pagos</option>
                                <option value="PENDING">Pendentes</option>
                                <option value="OVERDUE">Atrasados</option>
                            </select>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Carregando...</p>
                        </div>
                    ) : filteredAcademies.length === 0 ? (
                        <div className="empty-state">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                            </svg>
                            <h3>Nenhum pagamento encontrado</h3>
                            <p>Não há registros de pagamento com o filtro selecionado.</p>
                        </div>
                    ) : (
                        <div className="payments-table-container">
                            <table className="payments-table">
                                <thead>
                                    <tr>
                                        <th>Academia</th>
                                        <th>Plano</th>
                                        <th>Valor</th>
                                        <th>Vencimento</th>
                                        <th>Status Academia</th>
                                        <th>Status Pagamento</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAcademies.map((academy) => (
                                        <tr key={academy.id}>
                                            <td><strong>{academy.name}</strong></td>
                                            <td>{academy.plan_name || '-'}</td>
                                            <td className="payment-value">
                                                {academy.plan_value
                                                    ? `R$ ${academy.plan_value.toLocaleString('pt-BR')}`
                                                    : '-'}
                                            </td>
                                            <td>
                                                <span className={`due-date ${academy.payment_status === 'OVERDUE' ? 'overdue' : ''}`}>
                                                    {formatDate(academy.payment_due_date)}
                                                    {academy.payment_status === 'OVERDUE' && (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                                                        </svg>
                                                    )}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${academy.status === 'ACTIVE' ? 'active' : academy.status === 'SUSPENDED' ? 'suspended' : 'inactive'}`}>
                                                    {academy.status === 'ACTIVE' ? 'Ativa' : academy.status === 'SUSPENDED' ? 'Suspensa' : 'Inativa'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${getPaymentStatusClass(academy.payment_status)}`}>
                                                    {getPaymentStatusLabel(academy.payment_status)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="payment-actions">
                                                    {academy.payment_status !== 'PAID' && (
                                                        <button
                                                            className="btn-confirm"
                                                            onClick={() => handleConfirmPayment(academy)}
                                                            disabled={processingId === academy.id}
                                                        >
                                                            {processingId === academy.id ? '...' : 'Confirmar'}
                                                        </button>
                                                    )}
                                                    {academy.payment_status === 'PENDING' && (
                                                        <button
                                                            className="btn-warning"
                                                            onClick={() => handleMarkOverdue(academy)}
                                                            disabled={processingId === academy.id}
                                                        >
                                                            Atrasar
                                                        </button>
                                                    )}
                                                    {academy.payment_status === 'OVERDUE' && academy.status !== 'SUSPENDED' && (
                                                        <button
                                                            className="btn-suspend"
                                                            onClick={() => handleSuspend(academy)}
                                                            disabled={processingId === academy.id}
                                                        >
                                                            Suspender
                                                        </button>
                                                    )}
                                                    {academy.status === 'SUSPENDED' && (
                                                        <button
                                                            className="btn-activate"
                                                            onClick={() => handleReactivate(academy)}
                                                            disabled={processingId === academy.id}
                                                        >
                                                            Reativar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
