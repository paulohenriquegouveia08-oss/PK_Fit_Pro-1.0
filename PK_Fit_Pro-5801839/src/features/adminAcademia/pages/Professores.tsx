import { useState, useEffect, type FormEvent } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import {
    getAcademyMembers,
    createAcademyMember,
    updateAcademyMember,
    toggleMemberStatus,
    deleteAcademyMember,
    getCurrentAcademyId,
    type AcademyMember
} from '../../../shared/services/academyMember.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../../features/adminGlobal/styles/usuarios.css';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';

interface FormData {
    name: string;
    email: string;
    phone: string;
}

const initialFormData: FormData = {
    name: '',
    email: '',
    phone: ''
};

export default function Professores() {
    const [professors, setProfessors] = useState<AcademyMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedProfessor, setSelectedProfessor] = useState<AcademyMember | null>(null);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [editFormData, setEditFormData] = useState<FormData>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [academyId, setAcademyId] = useState<string | null>(null);

    // Load professors
    const loadProfessors = async () => {
        const acaId = getCurrentAcademyId();
        if (!acaId) {
            setIsLoading(false);
            return;
        }
        setAcademyId(acaId);

        setIsLoading(true);
        const result = await getAcademyMembers(acaId, 'PROFESSOR');
        if (result.success && result.data) {
            setProfessors(result.data);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadProfessors();
    }, []);

    // Filter professors
    const filteredProfessors = professors.filter(prof =>
        prof.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prof.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle create professor
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!academyId) {
            setMessage({ type: 'error', text: 'Academia não identificada. Faça logout e login novamente.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        const result = await createAcademyMember({
            name: formData.name,
            email: formData.email,
            phone: formData.phone || undefined,
            role: 'PROFESSOR',
            academy_id: academyId
        });

        if (result.success) {
            setMessage({ type: 'success', text: 'Professor criado com sucesso!' });
            setFormData(initialFormData);
            setShowModal(false);
            loadProfessors();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao criar professor' });
        }

        setIsSubmitting(false);
    };

    // Handle edit professor
    const handleEdit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedProfessor) return;

        setIsSubmitting(true);
        setMessage(null);

        const result = await updateAcademyMember(selectedProfessor.id, {
            name: editFormData.name,
            email: editFormData.email.toLowerCase(),
            phone: editFormData.phone || undefined
        });

        if (result.success) {
            setMessage({ type: 'success', text: 'Professor atualizado com sucesso!' });
            setShowEditModal(false);
            setSelectedProfessor(null);
            loadProfessors();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar professor' });
        }

        setIsSubmitting(false);
    };

    // Handle toggle status
    const handleToggleStatus = async (prof: AcademyMember) => {
        const result = await toggleMemberStatus(prof.id, !prof.is_active);
        if (result.success) {
            setMessage({ type: 'success', text: `Professor ${prof.is_active ? 'desativado' : 'ativado'} com sucesso!` });
            loadProfessors();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar status' });
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedProfessor) return;

        const result = await deleteAcademyMember(selectedProfessor.id);
        if (result.success) {
            setMessage({ type: 'success', text: 'Professor excluído com sucesso!' });
            setShowDeleteModal(false);
            setSelectedProfessor(null);
            loadProfessors();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao excluir professor' });
        }
    };

    // Helper functions
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    // Auto-hide message
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Open edit modal
    const openEditModal = (prof: AcademyMember) => {
        setSelectedProfessor(prof);
        setEditFormData({
            name: prof.name,
            email: prof.email,
            phone: prof.phone || ''
        });
        setShowEditModal(true);
    };

    return (
        <DashboardLayout title="Professores" menuItems={menuItems}>
            <div className="usuarios-page">
                {/* Message Toast */}
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="page-header">
                    <h2>Gerenciar Professores</h2>
                    <button className="btn-add" onClick={() => setShowModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                        Novo Professor
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
                            placeholder="Buscar professor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando professores...</p>
                    </div>
                ) : !academyId ? (
                    <div className="empty-state">
                        <h3>Academia não identificada</h3>
                        <p>Faça login novamente para acessar os dados.</p>
                    </div>
                ) : filteredProfessors.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                        </svg>
                        <h3>Nenhum professor encontrado</h3>
                        <p>Clique em "Novo Professor" para adicionar.</p>
                    </div>
                ) : (
                    <div className="users-grid">
                        {filteredProfessors.map((prof) => (
                            <div key={prof.id} className="user-card">
                                <div className="user-card-avatar">
                                    {getInitials(prof.name)}
                                </div>
                                <div className="user-card-info">
                                    <div className="user-card-name">{prof.name}</div>
                                    <div className="user-card-email">{prof.email}</div>
                                    <div className="user-card-meta">
                                        <span className="role-badge professor">Professor</span>
                                        <span
                                            className={`status-badge ${prof.is_active ? 'active' : 'inactive'}`}
                                            onClick={() => handleToggleStatus(prof)}
                                            style={{ cursor: 'pointer' }}
                                            title="Clique para alterar status"
                                        >
                                            {prof.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                            {prof.student_count || 0} alunos
                                        </span>
                                    </div>
                                </div>
                                <div className="user-card-actions">
                                    <button
                                        className="action-btn edit"
                                        title="Editar"
                                        onClick={() => openEditModal(prof)}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="action-btn delete"
                                        title="Excluir"
                                        onClick={() => {
                                            setSelectedProfessor(prof);
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

                {/* Modal Novo Professor */}
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Novo Professor</h3>
                                <button className="modal-close" onClick={() => setShowModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label className="form-label">Nome Completo *</label>
                                        <input
                                            type="text"
                                            name="name"
                                            className="form-input"
                                            placeholder="Nome completo"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            className="form-input"
                                            placeholder="email@exemplo.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            required
                                        />
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
                                        {isSubmitting ? 'Criando...' : 'Criar Professor'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal Editar Professor */}
                {showEditModal && selectedProfessor && (
                    <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Editar Professor</h3>
                                <button className="modal-close" onClick={() => setShowEditModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <form onSubmit={handleEdit}>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label className="form-label">Nome Completo *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Nome completo"
                                            value={editFormData.name}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email *</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            placeholder="email@exemplo.com"
                                            value={editFormData.email}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Telefone</label>
                                        <input
                                            type="tel"
                                            className="form-input"
                                            placeholder="(00) 00000-0000"
                                            value={editFormData.phone}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        />
                                    </div>
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
                {showDeleteModal && selectedProfessor && (
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
                                <p>Tem certeza que deseja excluir o professor <strong>{selectedProfessor.name}</strong>?</p>
                                <p className="warning-text">Esta ação não pode ser desfeita.</p>
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
