import { useState, useEffect, type FormEvent } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import {
    getAcademyPlans,
    createPlan,
    updatePlan,
    togglePlanStatus,
    deletePlan,
    type CreatePlanData
} from '../../../shared/services/plan.service';
import { getCurrentAcademyId } from '../../../shared/services/academyMember.service';
import type { Plan } from '../../../shared/types';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../../features/adminGlobal/styles/usuarios.css';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';

interface PlanFormData {
    name: string;
    price: string;
    duration_in_months: string;
    has_time_restriction: boolean;
    allowed_start_time: string;
    allowed_end_time: string;
}

const initialFormData: PlanFormData = {
    name: '',
    price: '',
    duration_in_months: '',
    has_time_restriction: false,
    allowed_start_time: '',
    allowed_end_time: ''
};

const durationOptions = [
    { value: '1', label: 'Mensal (1 mês)' },
    { value: '2', label: 'Bimestral (2 meses)' },
    { value: '3', label: 'Trimestral (3 meses)' },
    { value: '6', label: 'Semestral (6 meses)' },
    { value: '12', label: 'Anual (12 meses)' }
];

export default function Planos() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [formData, setFormData] = useState<PlanFormData>(initialFormData);
    const [editFormData, setEditFormData] = useState<PlanFormData>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [academyId, setAcademyId] = useState<string | null>(null);

    // Load plans
    const loadData = async () => {
        const acaId = getCurrentAcademyId();
        if (!acaId) {
            setIsLoading(false);
            return;
        }
        setAcademyId(acaId);
        setIsLoading(true);

        const result = await getAcademyPlans(acaId);

        if (result.success && result.data) {
            setPlans(result.data);
        }

        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filter plans
    const filteredPlans = plans.filter(plan =>
        plan.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({
                ...prev,
                [name]: checked,
                ...(name === 'has_time_restriction' && !checked ? { allowed_start_time: '', allowed_end_time: '' } : {})
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // Handle create plan
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!academyId) {
            setMessage({ type: 'error', text: 'Academia não identificada.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        const data: CreatePlanData = {
            academy_id: academyId,
            name: formData.name,
            price: parseFloat(formData.price) || 0,
            duration_in_months: parseInt(formData.duration_in_months) || 1,
            has_time_restriction: formData.has_time_restriction,
            allowed_start_time: formData.has_time_restriction ? formData.allowed_start_time : undefined,
            allowed_end_time: formData.has_time_restriction ? formData.allowed_end_time : undefined
        };

        const result = await createPlan(data);

        if (result.success) {
            setMessage({ type: 'success', text: 'Plano criado com sucesso!' });
            setFormData(initialFormData);
            setShowModal(false);
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao criar plano' });
        }

        setIsSubmitting(false);
    };

    // Handle edit plan
    const handleEdit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedPlan) return;

        setIsSubmitting(true);
        setMessage(null);

        const hasTime = editFormData.has_time_restriction;

        const result = await updatePlan(selectedPlan.id, {
            name: editFormData.name,
            price: parseFloat(editFormData.price) || 0,
            duration_in_months: parseInt(editFormData.duration_in_months) || 1,
            has_time_restriction: hasTime,
            allowed_start_time: hasTime ? editFormData.allowed_start_time : undefined,
            allowed_end_time: hasTime ? editFormData.allowed_end_time : undefined
        });

        if (result.success) {
            setMessage({ type: 'success', text: 'Plano atualizado com sucesso!' });
            setShowEditModal(false);
            setSelectedPlan(null);
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar plano' });
        }

        setIsSubmitting(false);
    };

    // Handle toggle status
    const handleToggleStatus = async (plan: Plan) => {
        const result = await togglePlanStatus(plan.id, !plan.is_active);
        if (result.success) {
            setMessage({ type: 'success', text: `Plano ${plan.is_active ? 'desativado' : 'ativado'} com sucesso!` });
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar status' });
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedPlan) return;

        const result = await deletePlan(selectedPlan.id);
        if (result.success) {
            setMessage({ type: 'success', text: 'Plano excluído com sucesso!' });
            setShowDeleteModal(false);
            setSelectedPlan(null);
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao excluir plano' });
        }
    };

    // Format price
    const formatPrice = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Duration label
    const getDurationLabel = (months: number) => {
        const option = durationOptions.find(o => o.value === String(months));
        if (option) return option.label;
        return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    };

    // Format time
    const formatTime = (time: string) => {
        return time ? time.substring(0, 5) : '';
    };

    // Auto-hide message
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Open edit modal
    const openEditModal = (plan: Plan) => {
        setSelectedPlan(plan);
        setEditFormData({
            name: plan.name,
            price: String(plan.price),
            duration_in_months: String(plan.duration_in_months),
            has_time_restriction: plan.has_time_restriction,
            allowed_start_time: plan.allowed_start_time ? formatTime(plan.allowed_start_time) : '',
            allowed_end_time: plan.allowed_end_time ? formatTime(plan.allowed_end_time) : ''
        });
        setShowEditModal(true);
    };

    // Render form fields (shared between create and edit modals)
    const renderFormFields = (
        data: PlanFormData,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void,
        isEdit: boolean = false
    ) => (
        <>
            <div className="form-group">
                <label className="form-label">Nome do Plano *</label>
                <input
                    type="text"
                    name="name"
                    className="form-input"
                    placeholder="Ex: Plano Mensal, Plano Trimestral..."
                    value={data.name}
                    onChange={onChange}
                    required
                />
            </div>
            <div className="form-group">
                <label className="form-label">Valor (R$) *</label>
                <input
                    type="number"
                    name="price"
                    className="form-input"
                    placeholder="0.00"
                    value={data.price}
                    onChange={onChange}
                    min="0"
                    step="0.01"
                    required
                />
            </div>
            <div className="form-group">
                <label className="form-label">Duração *</label>
                <select
                    name="duration_in_months"
                    className="form-input"
                    value={data.duration_in_months}
                    onChange={onChange}
                    required
                >
                    <option value="">Selecione a duração</option>
                    {durationOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
            <div className="form-group" style={{ marginBottom: data.has_time_restriction ? 'var(--spacing-2)' : undefined }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-primary)'
                }}>
                    <input
                        type="checkbox"
                        name="has_time_restriction"
                        checked={data.has_time_restriction}
                        onChange={isEdit ? (e) => {
                            const checked = e.target.checked;
                            if (isEdit) {
                                setEditFormData(prev => ({
                                    ...prev,
                                    has_time_restriction: checked,
                                    ...((!checked) ? { allowed_start_time: '', allowed_end_time: '' } : {})
                                }));
                            }
                        } : onChange}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary-500)' }}
                    />
                    Possui restrição de horário?
                </label>
            </div>
            {data.has_time_restriction && (
                <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Horário Início *</label>
                        <input
                            type="time"
                            name="allowed_start_time"
                            className="form-input"
                            value={data.allowed_start_time}
                            onChange={isEdit ? (e) => setEditFormData(prev => ({ ...prev, allowed_start_time: e.target.value })) : onChange}
                            required
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">Horário Fim *</label>
                        <input
                            type="time"
                            name="allowed_end_time"
                            className="form-input"
                            value={data.allowed_end_time}
                            onChange={isEdit ? (e) => setEditFormData(prev => ({ ...prev, allowed_end_time: e.target.value })) : onChange}
                            required
                        />
                    </div>
                </div>
            )}
        </>
    );

    return (
        <DashboardLayout title="Planos" menuItems={menuItems}>
            <div className="usuarios-page">
                {/* Message Toast */}
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="page-header">
                    <h2>Gestão de Planos</h2>
                    <button className="btn-add" onClick={() => setShowModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        Novo Plano
                    </button>
                </div>

                <div className="filters-bar">
                    <div className="search-input-wrapper">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Buscar plano..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando planos...</p>
                    </div>
                ) : !academyId ? (
                    <div className="empty-state">
                        <h3>Academia não identificada</h3>
                        <p>Faça login novamente para acessar os dados.</p>
                    </div>
                ) : filteredPlans.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
                        </svg>
                        <h3>Nenhum plano cadastrado</h3>
                        <p>Clique em "Novo Plano" para adicionar.</p>
                    </div>
                ) : (
                    <div className="users-grid">
                        {filteredPlans.map((plan) => (
                            <div key={plan.id} className="user-card">
                                <div className="user-card-avatar" style={{
                                    background: plan.is_active
                                        ? 'linear-gradient(135deg, var(--primary-500), var(--primary-600))'
                                        : 'var(--background-tertiary)'
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                        <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
                                    </svg>
                                </div>
                                <div className="user-card-info">
                                    <div className="user-card-name">{plan.name}</div>
                                    <div className="user-card-email" style={{ color: 'var(--primary-500)', fontWeight: 600 }}>
                                        {formatPrice(plan.price)}
                                    </div>
                                    <div className="user-card-meta">
                                        <span className="role-badge" style={{
                                            background: 'var(--primary-100)',
                                            color: 'var(--primary-700)'
                                        }}>
                                            {getDurationLabel(plan.duration_in_months)}
                                        </span>
                                        <span
                                            className={`status-badge ${plan.is_active ? 'active' : 'inactive'}`}
                                            onClick={() => handleToggleStatus(plan)}
                                            style={{ cursor: 'pointer' }}
                                            title="Clique para alterar status"
                                        >
                                            {plan.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    {plan.has_time_restriction && plan.allowed_start_time && plan.allowed_end_time && (
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--text-secondary)',
                                            marginTop: 'var(--spacing-1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 'var(--spacing-1)'
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                                            </svg>
                                            Horário: {formatTime(plan.allowed_start_time)} - {formatTime(plan.allowed_end_time)}
                                        </div>
                                    )}
                                    {!plan.has_time_restriction && (
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--success-500)',
                                            marginTop: 'var(--spacing-1)'
                                        }}>
                                            Horário livre
                                        </div>
                                    )}
                                </div>
                                <div className="user-card-actions">
                                    <button
                                        className="action-btn edit"
                                        title="Editar"
                                        onClick={() => openEditModal(plan)}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="action-btn delete"
                                        title="Excluir"
                                        onClick={() => {
                                            setSelectedPlan(plan);
                                            setShowDeleteModal(true);
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal Novo Plano */}
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Novo Plano</h3>
                                <button className="modal-close" onClick={() => setShowModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    {renderFormFields(formData, handleInputChange)}
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => setShowModal(false)}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Criando...' : 'Criar Plano'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal Editar Plano */}
                {showEditModal && selectedPlan && (
                    <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Editar Plano</h3>
                                <button className="modal-close" onClick={() => setShowEditModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleEdit}>
                                <div className="modal-body">
                                    {renderFormFields(editFormData, (e) => {
                                        const { name, value } = e.target;
                                        setEditFormData(prev => ({ ...prev, [name]: value }));
                                    }, true)}
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => setShowEditModal(false)}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Salvando...' : 'Salvar'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal Confirmar Exclusão */}
                {showDeleteModal && selectedPlan && (
                    <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                        <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Confirmar Exclusão</h3>
                                <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <div className="modal-body">
                                <p>Tem certeza que deseja excluir o plano <strong>{selectedPlan.name}</strong>?</p>
                                <p className="warning-text">Planos com alunos ativos vinculados não podem ser excluídos.</p>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowDeleteModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="btn-delete"
                                    onClick={handleDelete}
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
