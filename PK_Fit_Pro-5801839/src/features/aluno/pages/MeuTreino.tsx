import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlunoLayout } from '../../../shared/components/layout';
import { getCurrentStudentId, getStudentActiveWorkout, getStudentProfessor } from '../../../shared/services/student.service';
import { createWorkoutRequest, checkWorkoutUpdateNotification, markWorkoutUpdateAsSeen } from '../../../shared/services/workoutRequest.service';
import type { Workout } from '../../../shared/services/workout.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../styles/aluno.css';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';

export default function MeuTreino() {
    const navigate = useNavigate();
    const [workout, setWorkout] = useState<Workout | null>(null);
    const [professorId, setProfessorId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeDay, setActiveDay] = useState(0);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestMessage, setRequestMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showWorkoutUpdateBanner, setShowWorkoutUpdateBanner] = useState(false);

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

                // Check for workout update notification
                const notification = await checkWorkoutUpdateNotification(studentId);
                if (notification.hasUpdate) {
                    setShowWorkoutUpdateBanner(true);
                }
            }
            setIsLoading(false);
        };
        loadWorkout();
    }, []);

    const dismissUpdateBanner = async () => {
        const studentId = getCurrentStudentId();
        if (studentId) {
            await markWorkoutUpdateAsSeen(studentId);
        }
        setShowWorkoutUpdateBanner(false);
    };

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
            <AlunoLayout title="Minha Ficha de Treino" menuItems={menuItems}>
                <div className="aluno-dashboard">
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando treino...</p>
                    </div>
                </div>
            </AlunoLayout>
        );
    }

    if (!workout || !workout.days || workout.days.length === 0) {
        return (
            <AlunoLayout title="Minha Ficha de Treino" menuItems={menuItems}>
                <div className="aluno-dashboard">
                    {/* Success/Error Message */}
                    {message && (
                        <div className={`message-toast ${message.type}`}>
                            {message.text}
                        </div>
                    )}
                    <div className="page-header">
                        <h2>Minha Ficha de Treino</h2>
                    </div>
                    <div className="workout-card">
                        <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                            </svg>
                            <h3>Você ainda não possui uma ficha de treino cadastrada.</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-4)' }}>
                                Solicite ao seu professor para criar seu plano de treino personalizado.
                            </p>
                            {professorId && (
                                <button
                                    className="btn-add"
                                    onClick={() => setShowRequestModal(true)}
                                    style={{ fontSize: 'var(--font-size-base)', padding: 'var(--spacing-3) var(--spacing-6)', marginRight: 'var(--spacing-3)' }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                                    </svg>
                                    Solicitar Ficha de Treino
                                </button>
                            )}
                            <button
                                className="btn-add"
                                onClick={() => navigate('/aluno/criar-treino')}
                                style={{ fontSize: 'var(--font-size-base)', padding: 'var(--spacing-3) var(--spacing-6)', background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                </svg>
                                Criar Minha Própria Ficha
                            </button>
                        </div>
                    </div>

                    {/* Request Modal (reuse existing) */}
                    {showRequestModal && (
                        <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
                            <div className="modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h3 className="modal-title">Solicitar Ficha de Treino</h3>
                                    <button className="modal-close" onClick={() => setShowRequestModal(false)}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--text-secondary)' }}>
                                        Descreva suas necessidades para que seu professor crie um treino personalizado.
                                    </p>
                                    <form className="modal-form">
                                        <div className="form-group">
                                            <label className="form-label">O que você precisa?</label>
                                            <textarea
                                                className="form-input"
                                                rows={5}
                                                placeholder="Ex: Quero focar em hipertrofia, treino 4x por semana, tenho problema no joelho..."
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
            </AlunoLayout>
        );
    }

    const currentDay = workout.days[activeDay];

    return (
        <AlunoLayout title="Minha Ficha de Treino" menuItems={menuItems}>
            <div className="aluno-dashboard">
                {/* Workout Update Notification Banner */}
                {showWorkoutUpdateBanner && (
                    <div className="notification-banner success-banner">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        <div className="notification-content">
                            <strong>Treino Atualizado!</strong>
                            <p>Seu professor atualizou sua ficha de treino. Confira as novas alterações!</p>
                        </div>
                        <button className="notification-close" onClick={dismissUpdateBanner}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Success/Error Message */}
                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                    <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, margin: 0 }}>Minha Ficha de Treino</h2>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                        <button
                            onClick={() => {
                                if (!professorId) {
                                    setMessage({ type: 'error', text: 'Você ainda não possui um professor vinculado. Contate sua academia.' });
                                    return;
                                }
                                setShowRequestModal(true);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                fontWeight: 600,
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Solicitar Troca
                        </button>
                        <button
                            onClick={() => navigate('/aluno/criar-treino')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '12px',
                                fontWeight: 700,
                                fontSize: '14px',
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                            </svg>
                            Editar Meu Treino
                        </button>
                    </div>
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
        </AlunoLayout>
    );
}
