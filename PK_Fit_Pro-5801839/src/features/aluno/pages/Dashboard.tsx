import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentStudentId, getStudentDashboardInfo, type StudentInfo } from '../../../shared/services/student.service';
import { checkWorkoutUpdateNotification, markWorkoutUpdateAsSeen } from '../../../shared/services/workoutRequest.service';
import type { WorkoutDay } from '../../../shared/services/workout.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/aluno.css';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';

export default function Dashboard() {
    const [info, setInfo] = useState<StudentInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [firstDay, setFirstDay] = useState<WorkoutDay | null>(null);
    const [showWorkoutUpdateBanner, setShowWorkoutUpdateBanner] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const studentId = getCurrentStudentId();
            if (studentId) {
                // Load student info
                const result = await getStudentDashboardInfo(studentId);
                if (result.success && result.data) {
                    setInfo(result.data);
                    // Get first workout day for preview
                    if (result.data.workout?.days?.length) {
                        setFirstDay(result.data.workout.days[0]);
                    }
                }

                // Check for workout update notification
                const notification = await checkWorkoutUpdateNotification(studentId);
                if (notification.hasUpdate) {
                    setShowWorkoutUpdateBanner(true);
                }
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const dismissUpdateBanner = async () => {
        const studentId = getCurrentStudentId();
        if (studentId) {
            await markWorkoutUpdateAsSeen(studentId);
        }
        setShowWorkoutUpdateBanner(false);
    };

    if (isLoading) {
        return (
            <DashboardLayout title="Dashboard" menuItems={menuItems}>
                <div className="aluno-dashboard">
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    const totalDays = info?.workout?.days?.length || 0;
    const totalExercises = info?.workout?.days?.reduce((acc, day) => acc + day.exercises.length, 0) || 0;

    return (
        <DashboardLayout title="Dashboard" menuItems={menuItems}>
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
                        <a href="/aluno/treino" className="notification-action">Ver Treino</a>
                        <button className="notification-close" onClick={dismissUpdateBanner}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon primary">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{totalDays}</div>
                            <div className="stat-label">Dias de Treino</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon success">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{totalExercises}</div>
                            <div className="stat-label">Exercícios Total</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon secondary">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{info?.professor_name || '-'}</div>
                            <div className="stat-label">Seu Professor</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className={`stat-icon ${info?.has_workout ? 'success' : 'warning'}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{info?.has_workout ? 'Ativo' : 'Pendente'}</div>
                            <div className="stat-label">Status do Treino</div>
                        </div>
                    </div>
                </div>

                {/* Workout Preview or Empty State */}
                {info?.has_workout && firstDay ? (
                    <div className="workout-card">
                        <div className="workout-card-header">
                            <h3 className="workout-card-title">Treino {firstDay.day_label} - {firstDay.day_name}</h3>
                            <span className="workout-card-day">{totalDays} dias de treino</span>
                        </div>

                        <div className="exercise-view-list">
                            {firstDay.exercises.slice(0, 3).map((exercise, index) => (
                                <div key={exercise.id} className="exercise-preview-item">
                                    <span className="exercise-view-number">{index + 1}</span>
                                    <div className="exercise-view-info">
                                        <div className="exercise-view-name">{exercise.name}</div>
                                        <div className="exercise-view-details">
                                            <span className="exercise-view-detail">{exercise.sets} séries</span>
                                            <span className="exercise-view-detail">{exercise.reps} reps</span>
                                            <span className="exercise-view-detail">{exercise.rest}s descanso</span>
                                            {exercise.load && <span className="exercise-view-detail">{exercise.load}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {firstDay.exercises.length > 3 && (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: 'var(--spacing-3) 0 0' }}>
                                    +{firstDay.exercises.length - 3} mais exercícios
                                </p>
                            )}
                        </div>

                        <div style={{ marginTop: 'var(--spacing-6)', textAlign: 'center' }}>
                            <a href="/aluno/treino" className="btn-add">
                                Ver Treino Completo
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="workout-card">
                        <div className="empty-state" style={{ padding: 'var(--spacing-8)' }}>
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                            </svg>
                            <h3>Aguardando Treino</h3>
                            <p>Seu professor ainda não criou um treino para você.</p>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                {info?.professor_name
                                    ? `Seu professor é ${info.professor_name}`
                                    : 'Você ainda não foi vinculado a um professor'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
