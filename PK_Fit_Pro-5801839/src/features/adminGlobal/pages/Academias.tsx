import { useState, useEffect, type FormEvent } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import {
    getAcademies,
    createAcademy,
    updateAcademyStatus,
    deleteAcademy,
    type Academy
} from '../../../shared/services/academy.service';
import '../styles/dashboard.css';
import '../styles/academias.css';
import { adminGlobalMenuItems as menuItems } from '../../../shared/config/adminGlobalMenu';

interface FormData {
    name: string;
    email: string;
    phone: string;
    responsible_name: string;
    plan: string;
}

const initialFormData: FormData = {
    name: '',
    email: '',
    phone: '',
    responsible_name: '',
    plan: ''
};

const plans: { [key: string]: { name: string; value: number } } = {
    basic: { name: 'Básico', value: 149 },
    intermediate: { name: 'Intermediário', value: 199 },
    premium: { name: 'Premium', value: 299 }
};

export default function Academias() {
    const [academies, setAcademies] = useState<Academy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

    // Filter academies
    const filteredAcademies = academies.filter(academia => {
        const matchesSearch = academia.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (academia.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
        const matchesStatus = statusFilter === 'all' || academia.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle create academy
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage(null);

        const planData = plans[formData.plan];

        const result = await createAcademy({
            name: formData.name,
            email: formData.email,
            phone: formData.phone || undefined,
            responsible_name: formData.responsible_name,

            plan_name: planData?.name,
            plan_value: planData?.value
        });

        if (result.success) {
            setMessage({ type: 'success', text: 'Academia criada com sucesso!' });
            setFormData(initialFormData);
            setShowModal(false);
            loadAcademies();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao criar academia' });
        }

        setIsSubmitting(false);
    };

    // Handle status change
    const handleStatusChange = async (academy: Academy, newStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') => {
        const result = await updateAcademyStatus(academy.id, newStatus);
        if (result.success) {
            setMessage({ type: 'success', text: `Status da academia atualizado para ${getStatusLabel(newStatus)}` });
            loadAcademies();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar status' });
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedAcademy) return;

        const result = await deleteAcademy(selectedAcademy.id);
        if (result.success) {
            setMessage({ type: 'success', text: 'Academia excluída com sucesso!' });
            setShowDeleteModal(false);
            setSelectedAcademy(null);
            loadAcademies();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao excluir academia' });
        }
    };

    // Helper functions
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

    // Auto-hide message after 5 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    return (
        <DashboardLayout title="Academias" menuItems={menuItems}>
            <div className="academias-page">
                {/* Message Toast */}
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="page-header">
                    <h2>Gerenciar Academias</h2>
                    <button className="btn-add" onClick={() => setShowModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                        </svg>
                        Nova Academia
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
                            placeholder="Buscar academia..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todos os status</option>
                        <option value="ACTIVE">Ativas</option>
                        <option value="INACTIVE">Inativas</option>
                        <option value="SUSPENDED">Suspensas</option>
                    </select>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando academias...</p>
                    </div>
                ) : filteredAcademies.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
                        </svg>
                        <h3>Nenhuma academia encontrada</h3>
                        <p>Clique em "Nova Academia" para adicionar a primeira.</p>
                    </div>
                ) : (
                    <div className="academias-grid">
                        {filteredAcademies.map((academia) => (
                            <div key={academia.id} className="academia-card">
                                <div className="academia-card-header">
                                    <div className="academia-info">
                                        <h3>{academia.name}</h3>
                                        <p className="academia-email">{academia.email || 'Sem email'}</p>
                                    </div>
                                    <span className={`status-badge ${getStatusClass(academia.status)}`}>
                                        {getStatusLabel(academia.status)}
                                    </span>
                                </div>

                                <div className="academia-stats">
                                    <div className="academia-stat">
                                        <div className="academia-stat-value">{academia.plan_name || '-'}</div>
                                        <div className="academia-stat-label">Plano</div>
                                    </div>
                                    <div className="academia-stat">
                                        <div className="academia-stat-value">
                                            {academia.plan_value ? `R$ ${academia.plan_value}` : '-'}
                                        </div>
                                        <div className="academia-stat-label">Valor</div>
                                    </div>
                                    <div className="academia-stat">
                                        <span className={`status-badge ${getPaymentClass(academia.payment_status)}`}>
                                            {getPaymentLabel(academia.payment_status)}
                                        </span>
                                        <div className="academia-stat-label">Pagamento</div>
                                    </div>
                                </div>

                                <div className="academia-card-footer">
                                    <div className="status-actions">
                                        {academia.status !== 'ACTIVE' && (
                                            <button
                                                className="status-btn activate"
                                                onClick={() => handleStatusChange(academia, 'ACTIVE')}
                                                title="Ativar"
                                            >
                                                Ativar
                                            </button>
                                        )}
                                        {academia.status !== 'SUSPENDED' && (
                                            <button
                                                className="status-btn suspend"
                                                onClick={() => handleStatusChange(academia, 'SUSPENDED')}
                                                title="Suspender"
                                            >
                                                Suspender
                                            </button>
                                        )}
                                    </div>
                                    <div className="academia-actions">
                                        <button
                                            className="action-btn view"
                                            title="Ver Detalhes"
                                            onClick={() => {
                                                setSelectedAcademy(academia);
                                                setShowDetailsModal(true);
                                            }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                            </svg>
                                        </button>
                                        <button
                                            className="action-btn delete"
                                            title="Excluir"
                                            onClick={() => {
                                                setSelectedAcademy(academia);
                                                setShowDeleteModal(true);
                                            }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal Nova Academia */}
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Nova Academia</h3>
                                <button className="modal-close" onClick={() => setShowModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label className="form-label">Nome da Academia *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            className="form-input"
                                            placeholder="Ex: Academia Força Total"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email da Academia</label>
                                        <input
                                            type="email"
                                            name="email"
                                            className="form-input"
                                            placeholder="email@academia.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                        />
                                        <small style={{ color: '#666', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
                                            Este email será usado para o login da academia.
                                        </small>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Telefone</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            className="form-input"
                                            placeholder="(00) 00000-0000"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Nome do Responsável *</label>
                                        <input
                                            type="text"
                                            name="responsible_name"
                                            className="form-input"
                                            placeholder="Nome completo"
                                            value={formData.responsible_name}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Plano</label>
                                        <select
                                            name="plan"
                                            className="form-input"
                                            value={formData.plan}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Selecione um plano</option>
                                            <option value="basic">Básico - R$ 149/mês</option>
                                            <option value="intermediate">Intermediário - R$ 199/mês</option>
                                            <option value="premium">Premium - R$ 299/mês</option>
                                        </select>
                                    </div>
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
                                        {isSubmitting ? 'Criando...' : 'Criar Academia'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
                }

                {/* Modal Confirmar Exclusão */}
                {
                    showDeleteModal && selectedAcademy && (
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
                                    <p>Tem certeza que deseja excluir a academia <strong>{selectedAcademy.name}</strong>?</p>
                                    <p className="warning-text">Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.</p>
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
                    )
                }

                {/* Modal Detalhes da Academia */}
                {
                    showDetailsModal && selectedAcademy && (
                        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
                            <div className="modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h3 className="modal-title">Detalhes da Academia</h3>
                                    <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <div className="details-grid">
                                        <div className="details-item">
                                            <span className="details-label">Nome da Academia</span>
                                            <span className="details-value">{selectedAcademy.name}</span>
                                        </div>
                                        <div className="details-item">
                                            <span className="details-label">Email</span>
                                            <span className="details-value">{selectedAcademy.email || 'Não informado'}</span>
                                        </div>
                                        <div className="details-item">
                                            <span className="details-label">Telefone</span>
                                            <span className="details-value">{selectedAcademy.phone || 'Não informado'}</span>
                                        </div>
                                        <div className="details-item">
                                            <span className="details-label">Endereço</span>
                                            <span className="details-value">{selectedAcademy.address || 'Não informado'}</span>
                                        </div>
                                        <div className="details-item">
                                            <span className="details-label">Status</span>
                                            <span className={`status-badge ${getStatusClass(selectedAcademy.status)}`}>
                                                {getStatusLabel(selectedAcademy.status)}
                                            </span>
                                        </div>
                                        <div className="details-item">
                                            <span className="details-label">Plano</span>
                                            <span className="details-value">{selectedAcademy.plan_name || 'Não definido'}</span>
                                        </div>
                                        <div className="details-item">
                                            <span className="details-label">Valor do Plano</span>
                                            <span className="details-value">
                                                {selectedAcademy.plan_value ? `R$ ${selectedAcademy.plan_value},00` : 'Não definido'}
                                            </span>
                                        </div>
                                        <div className="details-item">
                                            <span className="details-label">Status do Pagamento</span>
                                            <span className={`status-badge ${getPaymentClass(selectedAcademy.payment_status)}`}>
                                                {getPaymentLabel(selectedAcademy.payment_status)}
                                            </span>
                                        </div>
                                        <div className="details-item full-width">
                                            <span className="details-label">Data de Cadastro</span>
                                            <span className="details-value">
                                                {selectedAcademy.created_at
                                                    ? new Date(selectedAcademy.created_at).toLocaleDateString('pt-BR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })
                                                    : 'Não disponível'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => setShowDetailsModal(false)}
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        </DashboardLayout >
    );
}
