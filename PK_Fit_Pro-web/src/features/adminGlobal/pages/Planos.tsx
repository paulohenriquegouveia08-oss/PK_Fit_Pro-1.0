import { useState, useEffect, type FormEvent } from 'react';
import { getGlobalPlans, createGlobalPlan, updateGlobalPlan, deleteGlobalPlan, type GlobalPlan } from '../../../shared/services/globalPlan.service';
import './admin-global.css';

export default function Planos() {
    const [plans, setPlans] = useState<GlobalPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<GlobalPlan | null>(null);

    // Form states
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [studentLimit, setStudentLimit] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setIsLoading(true);
        try {
            const res = await getGlobalPlans();
            if (res.success && res.data) {
                setPlans(res.data);
            } else {
                setError(res.error || 'Erro ao carregar planos');
            }
        } catch (err) {
            setError('Erro inesperado');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (plan?: GlobalPlan) => {
        if (plan) {
            setEditingPlan(plan);
            setName(plan.name);
            setPrice(plan.price.toString());
            setStudentLimit(plan.student_limit.toString());
            setIsActive(plan.is_active);
        } else {
            setEditingPlan(null);
            setName('');
            setPrice('');
            setStudentLimit('0');
            setIsActive(true);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setError('');
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        const payload = {
            name,
            price: parseFloat(price),
            student_limit: parseInt(studentLimit, 10),
            is_active: isActive
        };

        try {
            if (editingPlan) {
                const res = await updateGlobalPlan(editingPlan.id, payload);
                if (!res.success) throw new Error(res.error);
            } else {
                const res = await createGlobalPlan(payload);
                if (!res.success) throw new Error(res.error);
            }
            await fetchPlans();
            handleCloseModal();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar plano');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja deletar este plano?')) return;
        try {
            const res = await deleteGlobalPlan(id);
            if (res.success) {
                await fetchPlans();
            } else {
                alert(res.error || 'Erro ao deletar');
            }
        } catch {
            alert('Erro inesperado');
        }
    };

    return (
        <div className="admin-page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
                <h2>Gerenciar Planos SaaS</h2>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    Novo Plano
                </button>
            </div>

            {isLoading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Carregando planos...</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Preço (R$)</th>
                                <th>Limite de Alunos</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center' }}>Nenhum plano cadastrado.</td>
                                </tr>
                            ) : (
                                plans.map(plan => (
                                    <tr key={plan.id}>
                                        <td><strong>{plan.name}</strong></td>
                                        <td>{plan.price.toFixed(2)}</td>
                                        <td>{plan.student_limit === 999999 ? 'Ilimitado' : plan.student_limit}</td>
                                        <td>
                                            <span className={`status-badge status-${plan.is_active ? 'active' : 'inactive'}`}>
                                                {plan.is_active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn-icon" onClick={() => handleOpenModal(plan)} title="Editar">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                                </svg>
                                            </button>
                                            <button className="btn-icon text-danger" onClick={() => handleDelete(plan.id)} title="Excluir">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
                            <button className="modal-close" onClick={handleCloseModal}>&times;</button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert error">{error}</div>}
                            <form onSubmit={handleSubmit} className="form-grid">
                                <div className="form-group full-width">
                                    <label className="form-label">Nome do Plano</label>
                                    <input type="text" className="form-input" required
                                        value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Preço Mensal (R$)</label>
                                    <input type="number" step="0.01" min="0" className="form-input" required
                                        value={price} onChange={e => setPrice(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Limite de Alunos (999999 = Ilimitado)</label>
                                    <input type="number" min="0" className="form-input" required
                                        value={studentLimit} onChange={e => setStudentLimit(e.target.value)} />
                                </div>
                                <div className="form-group full-width">
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
                                        Plano Ativo
                                    </label>
                                </div>
                                <div className="modal-footer full-width">
                                    <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                        {isSubmitting ? 'Salvando...' : 'Salvar Plano'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
