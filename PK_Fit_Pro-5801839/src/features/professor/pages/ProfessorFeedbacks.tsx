import { useState, useEffect } from 'react';
import { ProfessorLayout } from '../../../shared/components/layout';
import { getCurrentProfessorId } from '../../../shared/services/professor.service';
import { getProfessorFeedbacks, getProfessorAverageRating, type Feedback } from '../../../shared/services/feedback.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/professor.css';
import { professorMenuItems as menuItems } from '../../../shared/config/professorMenu';

const StarDisplay = ({ rating, size = 20 }: { rating: number; size?: number }) => (
    <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(star => (
            <svg
                key={star}
                width={size} height={size}
                viewBox="0 0 24 24"
                fill={rating >= star ? '#f59e0b' : '#e5e7eb'}
            >
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
        ))}
    </div>
);

export default function ProfessorFeedbacks() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [average, setAverage] = useState(0);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        const loadData = async () => {
            const professorId = getCurrentProfessorId();
            if (!professorId) { setIsLoading(false); return; }

            const [fbRes, ratingRes] = await Promise.all([
                getProfessorFeedbacks(professorId),
                getProfessorAverageRating(professorId)
            ]);

            if (fbRes.success && fbRes.data) setFeedbacks(fbRes.data);
            setAverage(ratingRes.average);
            setTotal(ratingRes.total);
            setIsLoading(false);
        };
        loadData();
    }, []);

    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

    const getInitials = (name: string) =>
        name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    return (
        <ProfessorLayout title="Feedbacks" menuItems={menuItems}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                {/* Stats Card */}
                <div style={{
                    background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-6)',
                    color: '#fff',
                    textAlign: 'center',
                    marginBottom: 'var(--spacing-6)'
                }}>
                    <div style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1 }}>
                        {average > 0 ? average.toFixed(1) : '—'}
                    </div>
                    <div style={{ margin: '8px 0' }}>
                        <StarDisplay rating={Math.round(average)} size={24} />
                    </div>
                    <p style={{ opacity: 0.8, fontSize: 'var(--font-size-sm)', margin: 0 }}>
                        {total > 0 ? `${total} avaliação${total > 1 ? 'ões' : ''}` : 'Nenhuma avaliação ainda'}
                    </p>
                </div>

                {/* Feedbacks List */}
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-4)' }}>
                    ⭐ Avaliações Recebidas
                </h3>

                {isLoading ? (
                    <div className="loading-state"><div className="spinner"></div><p>Carregando...</p></div>
                ) : feedbacks.length === 0 ? (
                    <div className="empty-state">
                        <h3>Nenhuma avaliação</h3>
                        <p>Você ainda não recebeu feedbacks dos alunos.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                        {feedbacks.map(fb => (
                            <div key={fb.id} style={{
                                background: 'var(--card-bg, #fff)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border-color)',
                                padding: 'var(--spacing-4)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%',
                                            background: 'linear-gradient(135deg, var(--primary-500), var(--secondary-500))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontWeight: 700, fontSize: '12px'
                                        }}>
                                            {getInitials(fb.student_name || 'AL')}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                                {fb.student_name || 'Aluno'}
                                            </div>
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                {formatDate(fb.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                    <StarDisplay rating={fb.rating} size={16} />
                                </div>
                                <p style={{
                                    margin: 0,
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--text-primary)',
                                    background: 'var(--background-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 'var(--spacing-3)',
                                    lineHeight: 1.5
                                }}>
                                    "{fb.description}"
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ProfessorLayout>
    );
}
