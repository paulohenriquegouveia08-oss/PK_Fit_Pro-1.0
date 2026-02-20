import { useState, useEffect, type FormEvent } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import {
    getAcademyMembers,
    getAcademyProfessors,
    createAcademyMember,
    updateAcademyMember,
    toggleMemberStatus,
    deleteAcademyMember,
    getCurrentAcademyId,
    type AcademyMember
} from '../../../shared/services/academyMember.service';
import {
    getAcademyPlans,
    createStudentPlan,
    getStudentActivePlan,
    calculateEndDate,
    formatDateBR
} from '../../../shared/services/plan.service';
import {
    markStudentPlanAsPaid,
    markStudentPlanAsUnpaid,
    getStudentPaymentStatus
} from '../../../shared/services/financial.service';
import type { User, Plan } from '../../../shared/types';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../../features/adminGlobal/styles/usuarios.css';

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

interface FormData {
    name: string;
    email: string;
    phone: string;
    professor_id: string;
    plan_id: string;
}

const initialFormData: FormData = {
    name: '',
    email: '',
    phone: '',
    professor_id: '',
    plan_id: ''
};

// Student with plan info
interface StudentWithPlan extends AcademyMember {
    plan_name?: string;
    plan_id?: string;
    plan_start_date?: string;
    plan_end_date?: string;
    plan_has_time_restriction?: boolean;
    plan_allowed_start_time?: string;
    plan_allowed_end_time?: string;
    plan_price?: number;
    payment_status?: 'pago' | 'nao_pago';
}

export default function Alunos() {
    const [students, setStudents] = useState<StudentWithPlan[]>([]);
    const [professors, setProfessors] = useState<User[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProfessor, setFilterProfessor] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<StudentWithPlan | null>(null);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [editFormData, setEditFormData] = useState<FormData>(initialFormData);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [academyId, setAcademyId] = useState<string | null>(null);
    const [selectedPlanPreview, setSelectedPlanPreview] = useState<Plan | null>(null);

    // Load students, professors, and plans
    const loadData = async () => {
        const acaId = getCurrentAcademyId();
        if (!acaId) {
            setIsLoading(false);
            return;
        }
        setAcademyId(acaId);

        setIsLoading(true);

        const [studentsResult, professorsResult, plansResult] = await Promise.all([
            getAcademyMembers(acaId, 'ALUNO'),
            getAcademyProfessors(acaId),
            getAcademyPlans(acaId, true) // only active plans
        ]);

        if (professorsResult.success && professorsResult.data) {
            setProfessors(professorsResult.data);
        }

        if (plansResult.success && plansResult.data) {
            setPlans(plansResult.data);
        }

        if (studentsResult.success && studentsResult.data) {
            // Load plan info and payment status for each student
            const studentsWithPlans: StudentWithPlan[] = [];
            for (const student of studentsResult.data) {
                const planResult = await getStudentActivePlan(student.id);
                let paymentStatus: 'pago' | 'nao_pago' = 'nao_pago';
                if (planResult.data?.plan_id && acaId) {
                    paymentStatus = await getStudentPaymentStatus(student.id, planResult.data.plan_id, acaId);
                }
                studentsWithPlans.push({
                    ...student,
                    plan_name: planResult.data?.plan_name,
                    plan_id: planResult.data?.plan_id,
                    plan_start_date: planResult.data?.plan_start_date,
                    plan_end_date: planResult.data?.plan_end_date,
                    plan_has_time_restriction: planResult.data?.plan_has_time_restriction,
                    plan_allowed_start_time: planResult.data?.plan_allowed_start_time,
                    plan_allowed_end_time: planResult.data?.plan_allowed_end_time,
                    plan_price: planResult.data?.plan_price,
                    payment_status: paymentStatus
                });
            }
            setStudents(studentsWithPlans);
        }

        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filter students
    const filteredStudents = students.filter(aluno => {
        const matchesSearch = aluno.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            aluno.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProfessor = filterProfessor === 'all' || aluno.professor_id === filterProfessor;
        return matchesSearch && matchesProfessor;
    });

    // Handle form input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Update plan preview when plan is selected
        if (name === 'plan_id') {
            const plan = plans.find(p => p.id === value);
            setSelectedPlanPreview(plan || null);
        }
    };

    // Handle create student
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!academyId) {
            setMessage({ type: 'error', text: 'Academia não identificada. Faça logout e login novamente.' });
            return;
        }

        if (!formData.plan_id) {
            setMessage({ type: 'error', text: 'Selecione um plano para o aluno.' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        const result = await createAcademyMember({
            name: formData.name,
            email: formData.email,
            phone: formData.phone || undefined,
            role: 'ALUNO',
            academy_id: academyId,
            professor_id: formData.professor_id || undefined
        });

        if (result.success && result.data) {
            // Create student plan link
            const planResult = await createStudentPlan(result.data.id, formData.plan_id, academyId);

            if (planResult.success) {
                setMessage({ type: 'success', text: 'Aluno criado e plano vinculado com sucesso!' });
            } else {
                setMessage({ type: 'success', text: 'Aluno criado, mas houve erro ao vincular plano: ' + (planResult.error || '') });
            }

            setFormData(initialFormData);
            setSelectedPlanPreview(null);
            setShowModal(false);
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao criar aluno' });
        }

        setIsSubmitting(false);
    };

    // Handle edit student
    const handleEdit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) return;

        setIsSubmitting(true);
        setMessage(null);

        const result = await updateAcademyMember(
            selectedStudent.id,
            {
                name: editFormData.name,
                email: editFormData.email.toLowerCase(),
                phone: editFormData.phone || undefined
            },
            editFormData.professor_id || undefined
        );

        if (result.success) {
            setMessage({ type: 'success', text: 'Aluno atualizado com sucesso!' });
            setShowEditModal(false);
            setSelectedStudent(null);
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar aluno' });
        }

        setIsSubmitting(false);
    };

    // Handle toggle status
    const handleToggleStatus = async (student: AcademyMember) => {
        const result = await toggleMemberStatus(student.id, !student.is_active);
        if (result.success) {
            setMessage({ type: 'success', text: `Aluno ${student.is_active ? 'desativado' : 'ativado'} com sucesso!` });
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao atualizar status' });
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedStudent) return;

        const result = await deleteAcademyMember(selectedStudent.id);
        if (result.success) {
            setMessage({ type: 'success', text: 'Aluno excluído com sucesso!' });
            setShowDeleteModal(false);
            setSelectedStudent(null);
            loadData();
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao excluir aluno' });
        }
    };

    // Helper functions
    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const formatPrice = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const formatTime = (time: string) => {
        return time ? time.substring(0, 5) : '';
    };

    // Check if plan is expired
    const isPlanExpired = (endDate: string) => {
        if (!endDate) return false;
        return new Date(endDate) < new Date();
    };

    // Auto-hide message
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Open edit modal
    const openEditModal = (student: StudentWithPlan) => {
        setSelectedStudent(student);
        setEditFormData({
            name: student.name,
            email: student.email,
            phone: student.phone || '',
            professor_id: student.professor_id || '',
            plan_id: ''
        });
        setShowEditModal(true);
    };

    // Plan preview info for the create modal
    const renderPlanPreview = () => {
        if (!selectedPlanPreview) return null;

        const now = new Date();
        const endDate = calculateEndDate(now, selectedPlanPreview.duration_in_months);

        return (
            <div style={{
                background: 'var(--background-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-3)',
                marginTop: 'var(--spacing-2)'
            }}>
                <div style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'var(--spacing-2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-1)'
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary-500)">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    Resumo do Plano Selecionado
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)' }}>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>📅 Data de Início</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{formatDateBR(now)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>📅 Data de Término</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{formatDateBR(endDate)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>💰 Valor</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{formatPrice(selectedPlanPreview.price)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>⏱ Duração</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                            {selectedPlanPreview.duration_in_months} {selectedPlanPreview.duration_in_months === 1 ? 'mês' : 'meses'}
                        </div>
                    </div>
                </div>
                {selectedPlanPreview.has_time_restriction && selectedPlanPreview.allowed_start_time && selectedPlanPreview.allowed_end_time && (
                    <div style={{
                        marginTop: 'var(--spacing-2)',
                        paddingTop: 'var(--spacing-2)',
                        borderTop: '1px solid var(--border-color)'
                    }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>🕒 Horário Permitido</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                            {formatTime(selectedPlanPreview.allowed_start_time)} - {formatTime(selectedPlanPreview.allowed_end_time)}
                        </div>
                    </div>
                )}
                {!selectedPlanPreview.has_time_restriction && (
                    <div style={{
                        marginTop: 'var(--spacing-2)',
                        paddingTop: 'var(--spacing-2)',
                        borderTop: '1px solid var(--border-color)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--success-500)'
                    }}>
                        ✅ Horário livre (sem restrição)
                    </div>
                )}
            </div>
        );
    };

    return (
        <DashboardLayout title="Alunos" menuItems={menuItems}>
            <div className="usuarios-page">
                {/* Message Toast */}
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="page-header">
                    <h2>Gerenciar Alunos</h2>
                    <button className="btn-add" onClick={() => setShowModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                        Novo Aluno
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
                            placeholder="Buscar aluno..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="filter-select"
                        value={filterProfessor}
                        onChange={(e) => setFilterProfessor(e.target.value)}
                    >
                        <option value="all">Todos os professores</option>
                        {professors.map(prof => (
                            <option key={prof.id} value={prof.id}>{prof.name}</option>
                        ))}
                    </select>
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando alunos...</p>
                    </div>
                ) : !academyId ? (
                    <div className="empty-state">
                        <h3>Academia não identificada</h3>
                        <p>Faça login novamente para acessar os dados.</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                        <h3>Nenhum aluno encontrado</h3>
                        <p>Clique em "Novo Aluno" para adicionar.</p>
                    </div>
                ) : (
                    <div className="users-grid">
                        {filteredStudents.map((aluno) => (
                            <div key={aluno.id} className="user-card">
                                <div className="user-card-avatar">
                                    {getInitials(aluno.name)}
                                </div>
                                <div className="user-card-info">
                                    <div className="user-card-name">{aluno.name}</div>
                                    <div className="user-card-email">{aluno.email}</div>
                                    <div className="user-card-meta">
                                        <span className="role-badge aluno">Aluno</span>
                                        <span
                                            className={`status-badge ${aluno.is_active ? 'active' : 'inactive'}`}
                                            onClick={() => handleToggleStatus(aluno)}
                                            style={{ cursor: 'pointer' }}
                                            title="Clique para alterar status"
                                        >
                                            {aluno.is_active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 'var(--spacing-1)' }}>
                                        Prof: {aluno.professor_name || 'Não atribuído'}
                                    </div>
                                    {/* Plan information */}
                                    {aluno.plan_name ? (
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            marginTop: 'var(--spacing-1)',
                                            padding: 'var(--spacing-1) var(--spacing-2)',
                                            background: isPlanExpired(aluno.plan_end_date || '')
                                                ? 'rgba(239, 68, 68, 0.1)'
                                                : 'rgba(16, 185, 129, 0.1)',
                                            borderRadius: 'var(--radius-sm)',
                                            color: isPlanExpired(aluno.plan_end_date || '')
                                                ? 'var(--danger-500, #ef4444)'
                                                : 'var(--success-600, #059669)'
                                        }}>
                                            <div style={{ fontWeight: 600 }}>
                                                {isPlanExpired(aluno.plan_end_date || '') ? '⚠️ ' : '📋 '}
                                                {aluno.plan_name}
                                                {isPlanExpired(aluno.plan_end_date || '') && ' (Expirado)'}
                                            </div>
                                            <div style={{ opacity: 0.8 }}>
                                                {formatDate(aluno.plan_start_date || '')} → {formatDate(aluno.plan_end_date || '')}
                                            </div>
                                            {aluno.plan_has_time_restriction && aluno.plan_allowed_start_time && aluno.plan_allowed_end_time && (
                                                <div style={{ opacity: 0.8 }}>
                                                    🕒 {formatTime(aluno.plan_allowed_start_time)} - {formatTime(aluno.plan_allowed_end_time)}
                                                </div>
                                            )}
                                            {/* Payment status toggle */}
                                            <div style={{ marginTop: 'var(--spacing-1)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                                {aluno.payment_status === 'pago' ? (
                                                    <>
                                                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, background: 'var(--success-100)', color: 'var(--success-700)' }}>✅ Pago</span>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!academyId || !aluno.plan_id) return;
                                                                const res = await markStudentPlanAsUnpaid(aluno.id, aluno.plan_id, academyId);
                                                                if (res.success) {
                                                                    setStudents(prev => prev.map(s => s.id === aluno.id ? { ...s, payment_status: 'nao_pago' as const } : s));
                                                                } else {
                                                                    setMessage({ type: 'error', text: res.error || 'Erro ao estornar' });
                                                                }
                                                            }}
                                                            style={{ padding: '1px 6px', fontSize: 'var(--font-size-xs)', border: '1px solid var(--error-300)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--error-500)', cursor: 'pointer' }}
                                                            title="Estornar pagamento do mês corrente"
                                                        >
                                                            Estornar
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!academyId || !aluno.plan_id || !aluno.plan_price) return;
                                                            const res = await markStudentPlanAsPaid(aluno.id, aluno.plan_id, academyId, aluno.plan_price);
                                                            if (res.success) {
                                                                setStudents(prev => prev.map(s => s.id === aluno.id ? { ...s, payment_status: 'pago' as const } : s));
                                                            } else {
                                                                setMessage({ type: 'error', text: res.error || 'Erro ao registrar pagamento' });
                                                            }
                                                        }}
                                                        style={{ padding: '2px 10px', fontSize: 'var(--font-size-xs)', fontWeight: 600, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--success-500)', color: '#fff', cursor: 'pointer' }}
                                                    >
                                                        💳 Marcar como Pago
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            color: 'var(--warning-500, #f59e0b)',
                                            marginTop: 'var(--spacing-1)'
                                        }}>
                                            ⚠️ Sem plano vinculado
                                        </div>
                                    )}
                                </div>
                                <div className="user-card-actions">
                                    <button
                                        className="action-btn edit"
                                        title="Editar"
                                        onClick={() => openEditModal(aluno)}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="action-btn delete"
                                        title="Excluir"
                                        onClick={() => {
                                            setSelectedStudent(aluno);
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

                {/* Modal Novo Aluno */}
                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Novo Aluno</h3>
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
                                    <div className="form-group">
                                        <label className="form-label">Professor Responsável</label>
                                        <select
                                            name="professor_id"
                                            className="form-input"
                                            value={formData.professor_id}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Selecione um professor</option>
                                            {professors.map(prof => (
                                                <option key={prof.id} value={prof.id}>{prof.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Plan Selection */}
                                    <div className="form-group">
                                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--primary-500)">
                                                <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
                                            </svg>
                                            Plano *
                                        </label>
                                        <select
                                            name="plan_id"
                                            className="form-input"
                                            value={formData.plan_id}
                                            onChange={handleInputChange}
                                            required
                                            style={{
                                                borderColor: !formData.plan_id ? undefined : 'var(--primary-500)'
                                            }}
                                        >
                                            <option value="">Selecione um plano</option>
                                            {plans.map(plan => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.name} — {formatPrice(plan.price)} — {plan.duration_in_months} {plan.duration_in_months === 1 ? 'mês' : 'meses'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Plan Preview */}
                                    {renderPlanPreview()}
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => { setShowModal(false); setSelectedPlanPreview(null); }}
                                        disabled={isSubmitting}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-submit"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? 'Criando...' : 'Criar Aluno'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal Editar Aluno */}
                {showEditModal && selectedStudent && (
                    <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Editar Aluno</h3>
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
                                    <div className="form-group">
                                        <label className="form-label">Professor Responsável</label>
                                        <select
                                            className="form-input"
                                            value={editFormData.professor_id}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, professor_id: e.target.value }))}
                                        >
                                            <option value="">Selecione um professor</option>
                                            {professors.map(prof => (
                                                <option key={prof.id} value={prof.id}>{prof.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Current plan info (read-only in edit) */}
                                    {selectedStudent.plan_name && (
                                        <div style={{
                                            background: 'var(--background-secondary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-3)',
                                            marginTop: 'var(--spacing-1)'
                                        }}>
                                            <div style={{
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 600,
                                                color: 'var(--text-primary)',
                                                marginBottom: 'var(--spacing-1)'
                                            }}>
                                                📋 Plano Atual: {selectedStudent.plan_name}
                                            </div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                {formatDate(selectedStudent.plan_start_date || '')} → {formatDate(selectedStudent.plan_end_date || '')}
                                                {isPlanExpired(selectedStudent.plan_end_date || '') && (
                                                    <span style={{ color: 'var(--danger-500, #ef4444)', fontWeight: 600, marginLeft: 'var(--spacing-1)' }}>
                                                        (Expirado)
                                                    </span>
                                                )}
                                            </div>
                                            {selectedStudent.plan_has_time_restriction && selectedStudent.plan_allowed_start_time && selectedStudent.plan_allowed_end_time && (
                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                    🕒 {formatTime(selectedStudent.plan_allowed_start_time)} - {formatTime(selectedStudent.plan_allowed_end_time)}
                                                </div>
                                            )}
                                            <div style={{
                                                fontSize: 'var(--font-size-xs)',
                                                color: 'var(--text-tertiary)',
                                                marginTop: 'var(--spacing-1)',
                                                fontStyle: 'italic'
                                            }}>
                                                Para alterar o plano, acesse a gestão de planos.
                                            </div>
                                        </div>
                                    )}
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
                {showDeleteModal && selectedStudent && (
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
                                <p>Tem certeza que deseja excluir o aluno <strong>{selectedStudent.name}</strong>?</p>
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
