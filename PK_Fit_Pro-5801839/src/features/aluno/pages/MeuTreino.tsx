import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentStudentId, getStudentActiveWorkout, getStudentProfessor } from '../../../shared/services/student.service';
import { createWorkoutRequest } from '../../../shared/services/workoutRequest.service';
import type { Workout } from '../../../shared/services/workout.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../styles/aluno.css';

const menuItems = [
    {
        label: 'Dashboard',
        path: '/aluno',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
    },
    {
        label: 'Meu Treino',
        path: '/aluno/treino',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" /></svg>
    },
    {
        label: 'Meu Perfil',
        path: '/aluno/perfil',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
    }
];

export default function MeuTreino() {
    const [workout, setWorkout] = useState<Workout | null>(null);
    const [professorId, setProfessorId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeDay, setActiveDay] = useState(0);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestMessage, setRequestMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const loadWorkout = async () => {
            const studentId = getCurrentStudentId();
            if (studentId) {
                // Load workout
                const result = await getStudentActiveWorkout(studentId);
                if (result.success && result.data) {
                    setWorkout(result.data);
                }

                // Load professor
                const profResult = await getStudentProfessor(studentId);
                if (profResult.success && profResult.data) {
                    setProfessorId(profResult.data.id);
                }
            }
            setIsLoading(false);
        };
        loadWorkout();
    }, []);

    const handleRequestSubmit = async () => {
        const studentId = getCurrentStudentId();
        if (!studentId || !professorId) {
            setMessage({ type: 'error', text: 'Erro: você não está vinculado a um professor' });
            return;
        }

        if (!requestMessage.trim()) {
            setMessage({ type: 'error', text: 'Por favor, descreva o que precisa ser melhorado' });
            return;
        }

        setIsSubmitting(true);
        setMessage(null);

        const result = await createWorkoutRequest(studentId, professorId, requestMessage);

        if (result.success) {
            setMessage({ type: 'success', text: 'Solicitação enviada com sucesso! Seu professor será notificado.' });
            setShowRequestModal(false);
            setRequestMessage('');
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao enviar solicitação' });
        }

        setIsSubmitting(false);
    };

    if (isLoading) {
        return (
            <DashboardLayout title="Meu Treino" menuItems={menuItems}>
                <div className="aluno-dashboard">
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando treino...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!workout || !workout.days || workout.days.length === 0) {
        return (
            <DashboardLayout title="Meu Treino" menuItems={menuItems}>
                <div className="aluno-dashboard">
                    <div className="page-header">
                        <h2>Minha Ficha de Treino</h2>
                    </div>
                    <div className="workout-card">
                        <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                            </svg>
                            <h3>Sem treino cadastrado</h3>
                            <p>Seu professor ainda não criou uma ficha de treino para você.</p>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                Aguarde seu professor criar seu plano de treino personalizado.
                            </p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    const currentDay = workout.days[activeDay];

    return (
        <DashboardLayout title="Meu Treino" menuItems={menuItems}>
            <div className="aluno-dashboard">
                {/* Success/Error Message */}
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div className="page-header">
                    <h2>Minha Ficha de Treino</h2>
                    {professorId && (
                        <button className="request-workout-btn" onClick={() => setShowRequestModal(true)}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" />
                            </svg>
                            Solicitar Alteração
                        </button>
                    )}
                </div>

                {/* Day Tabs */}
                <div className="day-tabs">
                    {workout.days.map((day, index) => (
                        <button
                            key={day.id}
                            className={`day-tab ${activeDay === index ? 'active' : ''}`}
                            onClick={() => setActiveDay(index)}
                        >
                            <span className="day-tab-label">Treino {day.day_label}</span>
                            <span className="day-tab-name">{day.day_name}</span>
                        </button>
                    ))}
                </div>

                {/* Current Workout Day */}
                <div className="workout-card">
                    <div className="workout-card-header">
                        <h3 className="workout-card-title">{currentDay.day_name}</h3>
                        <span className="workout-card-day">Treino {currentDay.day_label}</span>
                    </div>

                    <div className="exercise-view-list">
                        {currentDay.exercises.map((exercise, index) => (
                            <div key={exercise.id} className="exercise-view-item">
                                <span className="exercise-view-number">{index + 1}</span>
                                <div className="exercise-view-info">
                                    <div className="exercise-view-name">{exercise.name}</div>
                                    <div className="exercise-view-details">
                                        <span className="exercise-view-detail">{exercise.sets} séries</span>
                                        <span className="exercise-view-detail">{exercise.reps} reps</span>
                                        <span className="exercise-view-detail">{exercise.rest}s descanso</span>
                                        {exercise.load && <span className="exercise-view-detail">{exercise.load}</span>}
                                    </div>
                                    {exercise.notes && (
                                        <div className="exercise-notes">
                                            <small>📝 {exercise.notes}</small>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="workout-summary">
                        <span>{currentDay.exercises.length} exercícios</span>
                        <span>|</span>
                        <span>{workout.days.length} dias de treino</span>
                    </div>
                </div>

                {/* Request Modal */}
                {showRequestModal && (
                    <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Solicitar Alteração de Treino</h3>
                                <button className="modal-close" onClick={() => setShowRequestModal(false)}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                    </svg>
                                </button>
                            </div>
                            <div className="modal-body">
                                <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--text-secondary)' }}>
                                    Descreva o que precisa ser melhorado ou alterado no seu treino.
                                    Seu professor receberá esta solicitação e fará as alterações necessárias.
                                </p>
                                <form className="modal-form">
                                    <div className="form-group">
                                        <label className="form-label">O que precisa ser melhorado?</label>
                                        <textarea
                                            className="form-input"
                                            rows={5}
                                            placeholder="Ex: Gostaria de trocar o supino reto por inclinado, preciso de exercícios mais leves para o joelho, quero adicionar mais exercícios de tríceps..."
                                            style={{ resize: 'vertical' }}
                                            value={requestMessage}
                                            onChange={(e) => setRequestMessage(e.target.value)}
                                        />
                                    </div>
                                </form>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={() => setShowRequestModal(false)}>Cancelar</button>
                                <button
                                    className="btn-submit"
                                    onClick={handleRequestSubmit}
                                    disabled={isSubmitting || !requestMessage.trim()}
                                >
                                    {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
