import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';
import { getCurrentAcademyId } from '../../../shared/services/academyMember.service';
import { getExpiringStudentPlans } from '../../../shared/services/membershipAlert.service';
import type { ExpiringStudentPlan } from '../../../shared/types';
import '../styles/mensalidades-vencendo.css';

// Gera a mensagem padrão para um aluno
function generateDefaultMessage(student: ExpiringStudentPlan): string {
    const [year, month, day] = student.plan_end_date.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    if (student.days_remaining === 0) {
        return `Olá ${student.student_name}! \n\nSua mensalidade do plano *${student.plan_name}* vence *hoje* (${formattedDate}).\n\nPara continuar treinando sem interrupções, realize o pagamento o quanto antes! \n\nQualquer dúvida, estamos à disposição.`;
    } else if (student.days_remaining === 1) {
        return `Olá ${student.student_name}! \n\nSua mensalidade do plano *${student.plan_name}* vence *amanhã* (${formattedDate}).\n\nRenove sua matrícula para continuar aproveitando todos os benefícios! \n\nQualquer dúvida, estamos à disposição.`;
    } else {
        return `Olá ${student.student_name}! \n\nSua mensalidade do plano *${student.plan_name}* vence em *${student.days_remaining} dias* (${formattedDate}).\n\nLembre-se de renovar para não perder acesso! \n\nQualquer dúvida, estamos à disposição.`;
    }
}

// Gera link WhatsApp com mensagem customizada
function buildCustomWhatsAppLink(phone: string, message: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}

export default function MensalidadesVencendo() {
    const [expiringPlans, setExpiringPlans] = useState<ExpiringStudentPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal de edição de mensagem
    const [editingStudent, setEditingStudent] = useState<ExpiringStudentPlan | null>(null);
    const [editMessage, setEditMessage] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        setError(null);
        const academyId = getCurrentAcademyId();
        if (!academyId) {
            setError('Academia não encontrada');
            setIsLoading(false);
            return;
        }

        const result = await getExpiringStudentPlans(academyId);
        if (result.success && result.data) {
            setExpiringPlans(result.data);
        } else {
            setError(result.error || 'Erro ao carregar dados');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Agrupar por dias restantes
    const groupedByDays = new Map<number, ExpiringStudentPlan[]>();
    for (const plan of expiringPlans) {
        const existing = groupedByDays.get(plan.days_remaining) || [];
        existing.push(plan);
        groupedByDays.set(plan.days_remaining, existing);
    }

    // Ordenar dos mais urgentes primeiro (0 → 5)
    const sortedDays = Array.from(groupedByDays.keys()).sort((a, b) => a - b);

    const getDayBadgeClass = (days: number) => {
        if (days <= 1) return 'urgent';
        if (days <= 3) return 'warning';
        return 'safe';
    };

    const getCardBorderClass = (days: number) => {
        if (days <= 1) return 'urgent-border';
        if (days <= 3) return 'warning-border';
        return 'safe-border';
    };

    const getDayLabel = (days: number) => {
        if (days === 0) return 'Vence HOJE';
        if (days === 1) return 'Vence amanhã';
        return `Vence em ${days} dias`;
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const formatPrice = (price: number) => {
        return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDateBR = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    // Abrir modal de edição de mensagem
    const handleOpenMessageEditor = (student: ExpiringStudentPlan) => {
        setEditingStudent(student);
        setEditMessage(generateDefaultMessage(student));
    };

    // Enviar via WhatsApp com mensagem editada
    const handleSendWhatsApp = () => {
        if (!editingStudent || !editingStudent.student_phone) return;
        const link = buildCustomWhatsAppLink(editingStudent.student_phone, editMessage);
        window.open(link, '_blank');
        setEditingStudent(null);
        setEditMessage('');
    };

    const totalExpiring = expiringPlans.length;

    return (
        <DashboardLayout title="Mensalidades Vencendo" menuItems={menuItems}>
            <div className="mensalidades-vencendo">
                {/* Header */}
                <div className="mensalidades-header">
                    <h2>
                        <span className="header-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                            </svg>
                        </span>
                        Mensalidades Vencendo
                    </h2>
                    {!isLoading && !error && (
                        <div className="header-summary">
                            <span className="count">{totalExpiring}</span>
                            {totalExpiring === 1 ? 'aluno com plano perto de vencer' : 'alunos com planos perto de vencer'}
                        </div>
                    )}
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Carregando mensalidades...</p>
                    </div>
                )}

                {/* Error */}
                {error && !isLoading && (
                    <div className="error-container">
                        <p>{error}</p>
                        <button className="retry-btn" onClick={loadData}>Tentar novamente</button>
                    </div>
                )}

                {/* Empty */}
                {!isLoading && !error && expiringPlans.length === 0 && (
                    <div className="empty-container">
                        <div className="empty-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                        <h3>Tudo em dia! ✨</h3>
                        <p>Nenhuma mensalidade vencendo nos próximos 5 dias. Todos os alunos estão com planos em dia.</p>
                    </div>
                )}

                {/* Grupos por dia */}
                {!isLoading && !error && sortedDays.map(days => {
                    const students = groupedByDays.get(days)!;
                    return (
                        <div key={days} className="day-group">
                            <div className="day-group-header">
                                <span className={`day-badge ${getDayBadgeClass(days)}`}>
                                    {days === 0 ? '⚠️' : days <= 1 ? '🔴' : days <= 3 ? '🟡' : '🟢'} {getDayLabel(days)}
                                </span>
                                <span className="day-group-count">
                                    {students.length} {students.length === 1 ? 'aluno' : 'alunos'}
                                </span>
                            </div>

                            <div className="student-cards">
                                {students.map(student => (
                                    <div key={student.student_plan_id} className={`student-card ${getCardBorderClass(days)}`}>
                                        <div className="student-card-top">
                                            <div className="student-avatar">
                                                {getInitials(student.student_name)}
                                            </div>
                                            <div className="student-info">
                                                <div className="student-name">{student.student_name}</div>
                                                <div className="student-plan-name">{student.plan_name}</div>
                                            </div>
                                        </div>

                                        <div className="student-card-details">
                                            <div className="detail-item">
                                                <svg viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
                                                </svg>
                                                <span className="value">{formatPrice(student.plan_price)}</span>
                                            </div>
                                            <div className="detail-item">
                                                <svg viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z" />
                                                </svg>
                                                <span className="value">{formatDateBR(student.plan_end_date)}</span>
                                            </div>
                                        </div>

                                        {student.student_phone ? (
                                            <button
                                                className="whatsapp-btn"
                                                onClick={() => handleOpenMessageEditor(student)}
                                            >
                                                <svg viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                </svg>
                                                Enviar Aviso pelo WhatsApp
                                            </button>
                                        ) : (
                                            <span className="whatsapp-btn disabled">
                                                <svg viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                </svg>
                                                Sem telefone cadastrado
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* Modal de Edição da Mensagem */}
                {editingStudent && (
                    <div className="modal-overlay" onClick={() => setEditingStudent(null)}>
                        <div className="modal-content message-editor-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>📝 Editar Mensagem para {editingStudent.student_name}</h3>
                                <button className="modal-close" onClick={() => setEditingStudent(null)}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <div className="modal-body">
                                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--gray-500)', marginBottom: 'var(--spacing-3)' }}>
                                    Edite a mensagem abaixo antes de enviar pelo WhatsApp. Use *texto* para negrito.
                                </p>
                                <textarea
                                    className="message-textarea"
                                    value={editMessage}
                                    onChange={e => setEditMessage(e.target.value)}
                                    rows={8}
                                />
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={() => setEditingStudent(null)}>
                                    Cancelar
                                </button>
                                <button
                                    className="whatsapp-btn"
                                    onClick={handleSendWhatsApp}
                                    style={{ width: 'auto' }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    Enviar pelo WhatsApp
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
