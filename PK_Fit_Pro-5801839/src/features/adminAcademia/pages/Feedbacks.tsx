import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentAcademyId } from '../../../shared/services/academyMember.service';
import {
    getAcademyProfessorsWithRatings,
    getAcademyProfessorFeedbacks,
    type ProfessorRating,
    type Feedback
} from '../../../shared/services/feedback.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../../features/adminGlobal/styles/usuarios.css';
import { adminAcademiaMenuItems as menuItems } from '../../../shared/config/adminAcademiaMenu';

// Star display
const Stars = ({ rating, size = 18 }: { rating: number; size?: number }) => (
    <div style={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map(s => (
            <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill={rating >= s ? '#f59e0b' : (rating >= s - 0.5 ? '#fbbf24' : '#e5e7eb')}>
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
        ))}
    </div>
);

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

// Modal wrapper (same as Financeiro)
const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={wide ? { maxWidth: '800px', width: '95%' } : {}}>
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

export default function Feedbacks() {
    const [ratings, setRatings] = useState<ProfessorRating[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [academyId, setAcademyId] = useState<string | null>(null);

    // Drill-down
    const [showModal, setShowModal] = useState(false);
    const [selectedProfName, setSelectedProfName] = useState('');
    const [profFeedbacks, setProfFeedbacks] = useState<Feedback[]>([]);
    const [modalLoading, setModalLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            const aId = getCurrentAcademyId();
            if (!aId) { setIsLoading(false); return; }
            setAcademyId(aId);

            const res = await getAcademyProfessorsWithRatings(aId);
            if (res.success && res.data) setRatings(res.data);
            setIsLoading(false);
        };
        load();
    }, []);

    const openProfessorFeedbacks = async (profId: string, profName: string) => {
        if (!academyId) return;
        setSelectedProfName(profName);
        setModalLoading(true);
        setShowModal(true);
        const res = await getAcademyProfessorFeedbacks(academyId, profId);
        if (res.success && res.data) setProfFeedbacks(res.data);
        setModalLoading(false);
    };

    const tblStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' };
    const thStyle: React.CSSProperties = { textAlign: 'left', padding: 'var(--spacing-2) var(--spacing-3)', borderBottom: '2px solid var(--border-color)', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' };
    const tdStyle: React.CSSProperties = { padding: 'var(--spacing-3)', borderBottom: '1px solid var(--border-color)' };

    return (
        <DashboardLayout title="Feedbacks" menuItems={menuItems}>
            <div style={{ padding: 0 }}>
                <div style={{ marginBottom: 'var(--spacing-6)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-1)' }}>⭐ Avaliações dos Professores</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Feedbacks enviados pelos alunos da academia</p>
                </div>

                {isLoading ? (
                    <div className="loading-state"><div className="spinner"></div><p>Carregando avaliações...</p></div>
                ) : !academyId ? (
                    <div className="empty-state"><h3>Academia não identificada</h3><p>Faça login novamente.</p></div>
                ) : ratings.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <h3>Nenhuma avaliação ainda</h3>
                        <p>Os alunos poderão avaliar os professores pela página de Feedback.</p>
                    </div>
                ) : (
                    <>
                        {/* Summary cards */}
                        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 'var(--spacing-6)' }}>
                            <div className="stat-card">
                                <div className="stat-icon" style={{ background: 'var(--warning-100)', color: 'var(--warning-600)' }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">
                                        {(ratings.reduce((s, r) => s + r.average_rating, 0) / ratings.length).toFixed(1)}
                                    </div>
                                    <div className="stat-label">Média Geral</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon primary">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" /></svg>
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{ratings.reduce((s, r) => s + r.total_feedbacks, 0)}</div>
                                    <div className="stat-label">Total Avaliações</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon success">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" /></svg>
                                </div>
                                <div className="stat-content">
                                    <div className="stat-value">{ratings.length}</div>
                                    <div className="stat-label">Professores Avaliados</div>
                                </div>
                            </div>
                        </div>

                        {/* Rankings table */}
                        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                            <table style={tblStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>#</th>
                                        <th style={thStyle}>Professor</th>
                                        <th style={thStyle}>Média</th>
                                        <th style={thStyle}>Avaliações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ratings.map((r, i) => (
                                        <tr
                                            key={r.professor_id}
                                            onClick={() => openProfessorFeedbacks(r.professor_id, r.professor_name)}
                                            style={{ cursor: 'pointer', transition: 'var(--transition-fast)' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--background-secondary)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        >
                                            <td style={tdStyle}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: i === 0 ? '#fef3c7' : i === 1 ? '#f3f4f6' : i === 2 ? '#fef9c3' : 'transparent', fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                                </span>
                                            </td>
                                            <td style={tdStyle}><strong style={{ color: 'var(--primary-600)' }}>{r.professor_name}</strong></td>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                                    <Stars rating={r.average_rating} />
                                                    <strong style={{ color: '#f59e0b' }}>{r.average_rating}</strong>
                                                </div>
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{ padding: '2px 12px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)', fontWeight: 600, background: 'var(--primary-100)', color: 'var(--primary-700)' }}>
                                                    {r.total_feedbacks}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-2)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                            Clique em um professor para ver os feedbacks individuais →
                        </div>
                    </>
                )}

                {/* Detail modal */}
                {showModal && (
                    <Modal title={`Feedbacks — ${selectedProfName}`} onClose={() => setShowModal(false)} wide>
                        {modalLoading ? <div className="loading-state"><div className="spinner"></div></div> : (
                            profFeedbacks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-6)', color: 'var(--text-secondary)' }}>Nenhum feedback encontrado</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                                    {profFeedbacks.map(fb => (
                                        <div key={fb.id} style={{ padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--background-primary, #fff)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                                                <strong style={{ fontSize: 'var(--font-size-sm)' }}>{fb.student_name}</strong>
                                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{formatDate(fb.created_at)}</span>
                                            </div>
                                            <Stars rating={fb.rating} size={16} />
                                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: 'var(--spacing-2)', lineHeight: 1.5 }}>{fb.description}</p>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </Modal>
                )}
            </div>
        </DashboardLayout>
    );
}
