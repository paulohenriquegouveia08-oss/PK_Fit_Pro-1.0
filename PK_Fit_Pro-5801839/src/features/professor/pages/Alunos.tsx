import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getProfessorStudents, getCurrentProfessorId, type ProfessorStudent } from '../../../shared/services/professor.service';
import { getStudentWorkout, type Workout } from '../../../shared/services/workout.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../../features/adminGlobal/styles/usuarios.css';
import '../styles/professor.css';

const menuItems = [
    {
        label: 'Dashboard',
        path: '/professor',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
    },
    {
        label: 'Meus Alunos',
        path: '/professor/alunos',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" /></svg>
    },
    {
        label: 'Criar Treino',
        path: '/professor/criar-treino',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
    },
    {
        label: 'Solicitações',
        path: '/professor/solicitacoes',
        icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 9h-2V5h2v6zm0 4h-2v-2h2v2z" /></svg>
    }
];

export default function Alunos() {
    const [students, setStudents] = useState<ProfessorStudent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<ProfessorStudent | null>(null);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showWorkoutModal, setShowWorkoutModal] = useState(false);
    const [studentWorkout, setStudentWorkout] = useState<Workout | null>(null);
    const [loadingWorkout, setLoadingWorkout] = useState(false);
    const [activeWorkoutDay, setActiveWorkoutDay] = useState(0);

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        const professorId = getCurrentProfessorId();
        if (professorId) {
            const result = await getProfessorStudents(professorId);
            if (result.success && result.data) {
                setStudents(result.data);
            }
        }
        setIsLoading(false);
    };

    const filteredStudents = students.filter(aluno =>
        aluno.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        aluno.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    };

    const handleViewInfo = (student: ProfessorStudent) => {
        setSelectedStudent(student);
        setShowInfoModal(true);
    };

    const handleViewWorkout = async (student: ProfessorStudent) => {
        setSelectedStudent(student);
        setShowWorkoutModal(true);
        setLoadingWorkout(true);
        setStudentWorkout(null);
        setActiveWorkoutDay(0);

        // Fetch the student's active workout
        const result = await getStudentWorkout(student.id);
        if (result.success && result.data) {
            setStudentWorkout(result.data);
        }
        setLoadingWorkout(false);
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const closeWorkoutModal = () => {
        setShowWorkoutModal(false);
        setStudentWorkout(null);
        setActiveWorkoutDay(0);
    };

    return (
        <DashboardLayout title="Meus Alunos" menuItems={menuItems}>
            <div className="usuarios-page">
                <div className="page-header">
                    <h2>Meus Alunos</h2>
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
                </div>

                {isLoading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando alunos...</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                        <h3>Nenhum aluno encontrado</h3>
                        <p>Você ainda não tem alunos vinculados. O administrador da academia pode atribuir alunos a você.</p>
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
                                        <span className={`status-badge ${aluno.has_workout ? 'active' : 'pending'}`}>
                                            {aluno.has_workout ? 'Com treino' : 'Sem treino'}
                                        </span>
                                    </div>
                                </div>
                                <div className="user-card-actions">
                                    <button
                                        className="action-btn edit"
                                        title="Ver Treino"
                                        onClick={() => handleViewWorkout(aluno)}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                                        </svg>
                                    </button>
                                    <a
                                        href={`/professor/criar-treino?studentId=${aluno.id}`}
                                        className="action-btn"
                                        title="Editar Treino"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                        </svg>
                                    </a>
                                    <button
                                        className="action-btn"
                                        title="Ver Informações"
                                        onClick={() => handleViewInfo(aluno)}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Student Info Modal */}
            {showInfoModal && selectedStudent && (
                <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Informações do Aluno</h2>
                            <button className="modal-close" onClick={() => setShowInfoModal(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-body">
                            <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
                                <div className="user-card-avatar" style={{ width: '80px', height: '80px', fontSize: '28px', margin: '0 auto' }}>
                                    {getInitials(selectedStudent.name)}
                                </div>
                            </div>
                            <div className="student-info-grid" style={{ display: 'grid', gap: 'var(--spacing-4)' }}>
                                <div className="info-row">
                                    <strong>Nome:</strong>
                                    <span>{selectedStudent.name}</span>
                                </div>
                                <div className="info-row">
                                    <strong>Email:</strong>
                                    <span>{selectedStudent.email}</span>
                                </div>
                                <div className="info-row">
                                    <strong>Telefone:</strong>
                                    <span>{selectedStudent.phone || 'Não informado'}</span>
                                </div>
                                <div className="info-row">
                                    <strong>Status:</strong>
                                    <span className={`status-badge ${selectedStudent.is_active ? 'active' : 'inactive'}`}>
                                        {selectedStudent.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                                <div className="info-row">
                                    <strong>Treino:</strong>
                                    <span className={`status-badge ${selectedStudent.has_workout ? 'active' : 'pending'}`}>
                                        {selectedStudent.has_workout ? 'Possui treino' : 'Sem treino'}
                                    </span>
                                </div>
                                <div className="info-row">
                                    <strong>Cadastrado em:</strong>
                                    <span>{formatDate(selectedStudent.created_at)}</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setShowInfoModal(false)}>Fechar</button>
                            <a href="/professor/criar-treino" className="btn-add">Criar Treino</a>
                        </div>
                    </div>
                </div>
            )}

            {/* Workout Modal */}
            {showWorkoutModal && selectedStudent && (
                <div className="modal-overlay" onClick={closeWorkoutModal}>
                    <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Treino de {selectedStudent.name}</h2>
                            <button className="modal-close" onClick={closeWorkoutModal}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-body">
                            {loadingWorkout ? (
                                <div className="loading-state">
                                    <div className="spinner"></div>
                                    <p>Carregando treino...</p>
                                </div>
                            ) : studentWorkout && studentWorkout.days && studentWorkout.days.length > 0 ? (
                                <div className="workout-view">
                                    {/* Day Tabs */}
                                    <div className="workout-day-tabs">
                                        {studentWorkout.days.map((day, index) => (
                                            <button
                                                key={day.id}
                                                className={`workout-day-tab ${activeWorkoutDay === index ? 'active' : ''}`}
                                                onClick={() => setActiveWorkoutDay(index)}
                                            >
                                                <span className="day-label">Treino {day.day_label}</span>
                                                <span className="day-name">{day.day_name}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Current Day Exercises */}
                                    <div className="workout-day-content">
                                        <h3 className="workout-day-title">
                                            Treino {studentWorkout.days[activeWorkoutDay].day_label} - {studentWorkout.days[activeWorkoutDay].day_name}
                                        </h3>
                                        <div className="exercises-list-view">
                                            {studentWorkout.days[activeWorkoutDay].exercises.map((exercise, exIndex) => (
                                                <div key={exercise.id} className="exercise-view-item">
                                                    <div className="exercise-view-number">{exIndex + 1}</div>
                                                    <div className="exercise-view-info">
                                                        <div className="exercise-view-name">{exercise.name}</div>
                                                        <div className="exercise-view-details">
                                                            <span>{exercise.sets} séries</span>
                                                            <span>{exercise.reps} reps</span>
                                                            <span>{exercise.rest}s descanso</span>
                                                            {exercise.load && <span>{exercise.load}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="workout-meta">
                                        <small>Criado em: {formatDate(studentWorkout.created_at)}</small>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state" style={{ padding: 'var(--spacing-6)' }}>
                                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                        <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
                                    </svg>
                                    <h3>Sem treino cadastrado</h3>
                                    <p>Este aluno ainda não possui um treino. Clique no botão abaixo para criar.</p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={closeWorkoutModal}>Fechar</button>
                            <a href="/professor/criar-treino" className="btn-add">
                                {studentWorkout ? 'Editar Treino' : 'Criar Treino'}
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
