import { useState, useEffect } from 'react';
import { AlunoLayout } from '../../../shared/components/layout';
import { getCurrentStudentId } from '../../../shared/services/student.service';
import { getStudentProfessor } from '../../../shared/services/student.service';
import { supabase } from '../../../shared/services/supabase';
import {
    getAcademyProfessorsList,
    createFeedback,
    getStudentFeedbacks,
    checkExistingFeedback,
    type Feedback as FeedbackType
} from '../../../shared/services/feedback.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../styles/aluno.css';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';

// Star rating component
const StarRating = ({ rating, onRate, size = 28, interactive = true }: { rating: number; onRate?: (r: number) => void; size?: number; interactive?: boolean }) => {
    const [hover, setHover] = useState(0);
    return (
        <div style={{ display: 'flex', gap: 2 }}>
            {[1, 2, 3, 4, 5].map(star => (
                <svg
                    key={star}
                    width={size} height={size}
                    viewBox="0 0 24 24"
                    fill={(hover || rating) >= star ? '#f59e0b' : '#e5e7eb'}
                    style={{ cursor: interactive ? 'pointer' : 'default', transition: 'all 0.15s' }}
                    onClick={() => interactive && onRate?.(star)}
                    onMouseEnter={() => interactive && setHover(star)}
                    onMouseLeave={() => interactive && setHover(0)}
                >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
            ))}
        </div>
    );
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export default function Feedback() {
    const [professors, setProfessors] = useState<{ id: string; name: string; email: string; alreadyRated: boolean; isLinkedProfessor: boolean }[]>([]);
    const [myFeedbacks, setMyFeedbacks] = useState<FeedbackType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [studentId, setStudentId] = useState<string | null>(null);
    const [academyId, setAcademyId] = useState<string | null>(null);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [selectedProf, setSelectedProf] = useState<{ id: string; name: string } | null>(null);
    const [rating, setRating] = useState(0);
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadData = async () => {
        const sId = getCurrentStudentId();
        if (!sId) { setIsLoading(false); return; }
        setStudentId(sId);

        // Get academy_id from academy_users (works for aluno role)
        let aId = academyId;
        if (!aId) {
            const { data: memberData } = await supabase
                .from('academy_users')
                .select('academy_id')
                .eq('user_id', sId)
                .limit(1)
                .single();
            aId = memberData?.academy_id || null;
        }
        if (!aId) { setIsLoading(false); return; }
        setAcademyId(aId);

        // Fetch linked professor, all academy professors, and student feedbacks in parallel
        const [linkedProfRes, profsRes, fbRes] = await Promise.all([
            getStudentProfessor(sId),
            getAcademyProfessorsList(aId),
            getStudentFeedbacks(sId)
        ]);

        const linkedProfId = linkedProfRes.success && linkedProfRes.data ? linkedProfRes.data.id : null;

        if (profsRes.success && profsRes.data) {
            // Check which professors already have feedback
            const profsWithStatus = [];
            for (const p of profsRes.data) {
                const rated = await checkExistingFeedback(sId, p.id);
                profsWithStatus.push({
                    ...p,
                    alreadyRated: rated,
                    isLinkedProfessor: p.id === linkedProfId
                });
            }
            // Sort: linked professor first
            profsWithStatus.sort((a, b) => {
                if (a.isLinkedProfessor && !b.isLinkedProfessor) return -1;
                if (!a.isLinkedProfessor && b.isLinkedProfessor) return 1;
                return 0;
            });
            setProfessors(profsWithStatus);
        }

        if (fbRes.success && fbRes.data) setMyFeedbacks(fbRes.data);
        setIsLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const openRateModal = (prof: { id: string; name: string }) => {
        setSelectedProf(prof);
        setRating(0);
        setDescription('');
        setMessage(null);
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!studentId || !academyId || !selectedProf) return;
        if (rating === 0) { setMessage({ type: 'error', text: 'Selecione uma avaliação de 1 a 5 estrelas' }); return; }
        if (description.trim().length < 10) { setMessage({ type: 'error', text: 'Descrição deve ter no mínimo 10 caracteres' }); return; }

        setIsSubmitting(true);
        setMessage(null);

        const res = await createFeedback({
            academy_id: academyId,
            student_id: studentId,
            professor_id: selectedProf.id,
            rating,
            description: description.trim()
        });

        if (res.success) {
            setMessage({ type: 'success', text: 'Feedback enviado com sucesso! ⭐' });
            setTimeout(() => { setShowModal(false); loadData(); }, 1200);
        } else {
            setMessage({ type: 'error', text: res.error || 'Erro ao enviar feedback' });
        }
        setIsSubmitting(false);
    };

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return (
        <AlunoLayout title="" menuItems={menuItems}> {/*Deixar sem nome*/}
            <div style={{ padding: 0 }}>
                <div style={{ marginBottom: 'var(--spacing-6)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-1)' }}>⭐ Avaliar Professores</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Avalie os professores da sua academia</p>
                </div>

                {isLoading ? (
                    <div className="loading-state"><div className="spinner"></div><p>Carregando...</p></div>
                ) : professors.length === 0 ? (
                    <div className="empty-state">
                        <h3>Nenhum professor disponível</h3>
                        <p>Não há professores cadastrados na sua academia.</p>
                    </div>
                ) : (
                    <>
                        {/* Professor cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-8)' }}>
                            {professors.map(prof => (
                                <div key={prof.id} style={{
                                    background: 'var(--background-primary, #fff)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: prof.isLinkedProfessor ? '2px solid var(--primary-400)' : '1px solid var(--border-color)',
                                    padding: 'var(--spacing-4)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-3)',
                                    boxShadow: prof.isLinkedProfessor ? '0 2px 8px rgba(99, 102, 241, 0.15)' : 'none'
                                }}>
                                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: prof.isLinkedProfessor ? 'linear-gradient(135deg, var(--primary-500), var(--primary-700))' : 'linear-gradient(135deg, var(--primary-500), var(--secondary-500))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 'var(--font-size-sm)', flexShrink: 0 }}>
                                        {getInitials(prof.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{prof.name}</div>
                                        {prof.isLinkedProfessor && (
                                            <div style={{
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 600,
                                                color: 'var(--primary-600)',
                                                marginTop: '2px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                ⭐ Professor Responsável
                                            </div>
                                        )}
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prof.email}</div>
                                    </div>
                                    {prof.alreadyRated ? (
                                        <span style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 600, background: 'var(--success-100)', color: 'var(--success-700)', whiteSpace: 'nowrap' }}>✅ Avaliado</span>
                                    ) : (
                                        <button onClick={() => openRateModal(prof)} style={{ padding: '6px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--primary-500)', color: '#fff', fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            ⭐ Avaliar
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* My feedbacks */}
                        {myFeedbacks.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-4)' }}>📝 Minhas Avaliações</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                                    {myFeedbacks.map(fb => (
                                        <div key={fb.id} style={{ background: 'var(--background-primary, #fff)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 'var(--spacing-4)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                                                <strong style={{ fontSize: 'var(--font-size-sm)' }}>{fb.professor_name}</strong>
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{formatDate(fb.created_at)}</span>
                                            </div>
                                            <StarRating rating={fb.rating} interactive={false} size={20} />
                                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: 'var(--spacing-2)', lineHeight: 1.5 }}>{fb.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Rating Modal */}
                {showModal && selectedProf && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Avaliar {selectedProf.name}</h3>
                                <button className="modal-close" onClick={() => setShowModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                                </button>
                            </div>
                            <div className="modal-body">
                                {message && (
                                    <div style={{ padding: 'var(--spacing-2) var(--spacing-3)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--spacing-3)', background: message.type === 'success' ? 'var(--success-50)' : 'var(--error-50)', color: message.type === 'success' ? 'var(--success-700)' : 'var(--error-700)', fontSize: 'var(--font-size-sm)' }}>
                                        {message.text}
                                    </div>
                                )}
                                <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-4)' }}>
                                    <p style={{ marginBottom: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Como você avalia este professor?</p>
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <StarRating rating={rating} onRate={setRating} size={40} />
                                    </div>
                                    {rating > 0 && (
                                        <div style={{ marginTop: 'var(--spacing-2)', fontWeight: 600, color: '#f59e0b', fontSize: 'var(--font-size-sm)' }}>
                                            {['', 'Muito Ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'][rating]}
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descreva sua experiência *</label>
                                    <textarea
                                        className="form-input"
                                        rows={4}
                                        placeholder="Conte como foi sua experiência com este professor (mínimo 10 caracteres)..."
                                        style={{ resize: 'vertical' }}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                    />
                                    <div style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)', color: description.length >= 10 ? 'var(--success-500)' : 'var(--text-secondary)', marginTop: 'var(--spacing-1)' }}>
                                        {description.length}/10 caracteres mínimos
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button
                                    className="btn-submit"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || rating === 0 || description.trim().length < 10}
                                >
                                    {isSubmitting ? 'Enviando...' : '⭐ Enviar Feedback'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AlunoLayout>
    );
}
