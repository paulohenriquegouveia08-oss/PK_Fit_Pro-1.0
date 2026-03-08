import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ProfessorLayout } from '../../../shared/components/layout';
import { getProfessorStudents, getCurrentProfessorId, type ProfessorStudent } from '../../../shared/services/professor.service';
import { createWorkout, getStudentWorkout, updateWorkout, type Exercise, type WorkoutDay } from '../../../shared/services/workout.service';
import { markWorkoutAsUpdated } from '../../../shared/services/workoutRequest.service';
import { allMuscleGroups, getExercisesForDayName } from '../../../shared/data/exerciseCatalog';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../styles/professor.css';
import '../styles/exerciseCatalog.css';
import { professorMenuItems as menuItems } from '../../../shared/config/professorMenu';

const DAY_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const createEmptyExercise = (): Exercise => ({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    name: '',
    sets: 3,
    reps: '10-12',
    rest: 60,
    load: ''
});

const createEmptyDay = (label: string): WorkoutDay => ({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    day_label: label,
    day_name: '',
    exercises: [createEmptyExercise()]
});

// ─── Muscle Group Dropdown ──────────────────────────
function MuscleGroupDropdown({ value, onChange }: { value: string; onChange: (name: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredGroups = allMuscleGroups.filter(g =>
        g.label.toLowerCase().includes((search || value).toLowerCase())
    );

    return (
        <div className="autocomplete-wrapper" ref={wrapperRef}>
            <input
                type="text"
                className="form-input day-name-input"
                placeholder="Selecione ou digite (Ex: Peito, Costas...)"
                value={isOpen ? search : value}
                onFocus={() => {
                    setIsOpen(true);
                    setSearch(value);
                }}
                onChange={(e) => {
                    setSearch(e.target.value);
                    onChange(e.target.value);
                }}
            />
            {isOpen && (
                <div className="autocomplete-dropdown">
                    {filteredGroups.length > 0 ? (
                        filteredGroups.map(group => (
                            <div
                                key={group.label}
                                className="autocomplete-item"
                                onClick={() => {
                                    onChange(group.label);
                                    setSearch('');
                                    setIsOpen(false);
                                }}
                            >
                                <span className="autocomplete-item-icon">{group.icon}</span>
                                <span className="autocomplete-item-label">{group.label}</span>
                                <span className="autocomplete-item-count">{group.exercises.length} exercícios</span>
                            </div>
                        ))
                    ) : (
                        <div className="autocomplete-item" style={{ color: 'var(--text-secondary)', cursor: 'default' }}>
                            Nenhum grupo encontrado — o nome digitado será usado
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Exercise Autocomplete ──────────────────────────
function ExerciseAutocomplete({
    value,
    dayName,
    onChange,
}: {
    value: string;
    dayName: string;
    onChange: (name: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const catalogExercises = getExercisesForDayName(dayName);
    const query = (isOpen ? search : value).toLowerCase();

    const filteredExercises = catalogExercises.filter(ex =>
        ex.toLowerCase().includes(query)
    );

    return (
        <div className="exercise-autocomplete" ref={wrapperRef}>
            <input
                type="text"
                className="form-input exercise-item-name"
                placeholder={catalogExercises.length > 0 ? 'Digite ou selecione um exercício' : 'Nome do exercício'}
                value={isOpen ? search : value}
                onFocus={() => {
                    setIsOpen(true);
                    setSearch(value);
                }}
                onChange={(e) => {
                    setSearch(e.target.value);
                    onChange(e.target.value);
                }}
            />
            {isOpen && filteredExercises.length > 0 && (
                <div className="autocomplete-dropdown">
                    {filteredExercises.map(ex => (
                        <div
                            key={ex}
                            className="autocomplete-item"
                            onClick={() => {
                                onChange(ex);
                                setSearch('');
                                setIsOpen(false);
                            }}
                        >
                            <span className="autocomplete-item-label">{ex}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ──────────────────────────────────
export default function CriarTreino() {
    const location = useLocation();

    // Get student ID from URL params if editing
    const queryParams = new URLSearchParams(location.search);
    const editStudentId = queryParams.get('studentId');

    const [students, setStudents] = useState<ProfessorStudent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(editStudentId || '');
    const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([createEmptyDay('A')]);
    const [activeDay, setActiveDay] = useState(0);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [existingWorkoutId, setExistingWorkoutId] = useState<string | null>(null);
    const [loadingWorkout, setLoadingWorkout] = useState(false);

    useEffect(() => {
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
        loadStudents();
    }, []);

    // Load existing workout when student is selected
    useEffect(() => {
        const loadExistingWorkout = async () => {
            if (!selectedStudent) {
                setIsEditMode(false);
                setExistingWorkoutId(null);
                setWorkoutDays([createEmptyDay('A')]);
                setActiveDay(0);
                return;
            }

            setLoadingWorkout(true);
            const result = await getStudentWorkout(selectedStudent);

            if (result.success && result.data && result.data.days && result.data.days.length > 0) {
                // Workout exists - enter edit mode
                setIsEditMode(true);
                setExistingWorkoutId(result.data.id);
                setWorkoutDays(result.data.days);
                setActiveDay(0);
            } else {
                // No workout - create mode
                setIsEditMode(false);
                setExistingWorkoutId(null);
                setWorkoutDays([createEmptyDay('A')]);
                setActiveDay(0);
            }

            setLoadingWorkout(false);
        };

        loadExistingWorkout();
    }, [selectedStudent]);

    const addDay = () => {
        if (workoutDays.length >= 7) {
            setMessage({ type: 'error', text: 'Máximo de 7 dias de treino atingido!' });
            return;
        }
        const nextLabel = DAY_LABELS[workoutDays.length];
        setWorkoutDays([...workoutDays, createEmptyDay(nextLabel)]);
        setActiveDay(workoutDays.length);
    };

    const removeDay = (index: number) => {
        if (workoutDays.length <= 1) {
            setMessage({ type: 'error', text: 'É necessário ter pelo menos 1 dia de treino!' });
            return;
        }
        const newDays = workoutDays.filter((_, i) => i !== index);
        // Update labels
        newDays.forEach((day, i) => {
            day.day_label = DAY_LABELS[i];
        });
        setWorkoutDays(newDays);
        if (activeDay >= newDays.length) {
            setActiveDay(newDays.length - 1);
        }
    };

    const updateDayName = (index: number, name: string) => {
        const newDays = [...workoutDays];
        newDays[index].day_name = name;
        setWorkoutDays(newDays);
    };

    const addExercise = (dayIndex: number) => {
        const newDays = [...workoutDays];
        newDays[dayIndex].exercises.push(createEmptyExercise());
        setWorkoutDays(newDays);
    };

    const removeExercise = (dayIndex: number, exerciseIndex: number) => {
        const newDays = [...workoutDays];
        if (newDays[dayIndex].exercises.length <= 1) {
            setMessage({ type: 'error', text: 'É necessário ter pelo menos 1 exercício!' });
            return;
        }
        newDays[dayIndex].exercises = newDays[dayIndex].exercises.filter((_, i) => i !== exerciseIndex);
        setWorkoutDays(newDays);
    };

    const updateExercise = (dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string | number) => {
        const newDays = [...workoutDays];
        (newDays[dayIndex].exercises[exerciseIndex] as any)[field] = value;
        setWorkoutDays(newDays);
    };

    const handleSave = async () => {
        if (!selectedStudent) {
            setMessage({ type: 'error', text: 'Selecione um aluno!' });
            return;
        }

        // Validate all days have names
        const emptyDayName = workoutDays.find(day => !day.day_name.trim());
        if (emptyDayName) {
            setMessage({ type: 'error', text: `Dia ${emptyDayName.day_label} precisa de um nome!` });
            return;
        }

        // Validate all exercises have names
        for (const day of workoutDays) {
            const emptyExercise = day.exercises.find(ex => !ex.name.trim());
            if (emptyExercise) {
                setMessage({ type: 'error', text: `Dia ${day.day_label}: Preencha o nome de todos os exercícios!` });
                return;
            }
        }

        const professorId = getCurrentProfessorId();
        if (!professorId) {
            setMessage({ type: 'error', text: 'Erro ao identificar professor!' });
            return;
        }

        setIsSaving(true);
        setMessage(null);

        let result;

        if (isEditMode && existingWorkoutId) {
            // Update existing workout
            result = await updateWorkout(existingWorkoutId, workoutDays.map(day => ({
                day_label: day.day_label,
                day_name: day.day_name,
                exercises: day.exercises
            })));

            if (result.success) {
                // Notify student about the update
                await markWorkoutAsUpdated(selectedStudent);
            }
        } else {
            // Create new workout
            result = await createWorkout({
                student_id: selectedStudent,
                professor_id: professorId,
                days: workoutDays.map(day => ({
                    day_label: day.day_label,
                    day_name: day.day_name,
                    exercises: day.exercises
                }))
            });
        }

        if (result.success) {
            setMessage({
                type: 'success',
                text: isEditMode ? 'Treino atualizado com sucesso! O aluno será notificado.' : 'Treino salvo com sucesso!'
            });

            if (!isEditMode) {
                // Reset form only for new workouts
                setSelectedStudent('');
                setWorkoutDays([createEmptyDay('A')]);
                setActiveDay(0);
                setIsEditMode(false);
                setExistingWorkoutId(null);
            }
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao salvar treino' });
        }

        setIsSaving(false);
    };

    const currentDay = workoutDays[activeDay];
    const selectedStudentName = students.find(s => s.id === selectedStudent)?.name || '';
    const catalogExercises = getExercisesForDayName(currentDay.day_name);

    return (
        <ProfessorLayout title={isEditMode ? 'Editar Treino' : 'Criar Treino'} menuItems={menuItems}>
            <div className="criar-treino-page">
                <div className="page-header">
                    <h2>{isEditMode ? `Editar Treino - ${selectedStudentName}` : 'Criar Novo Treino'}</h2>
                    <button className="btn-add" onClick={handleSave} disabled={isSaving || loadingWorkout}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                        </svg>
                        {isSaving ? 'Salvando...' : (isEditMode ? 'Salvar Alterações' : 'Salvar Treino')}
                    </button>
                </div>

                {message && (
                    <div className={`message-toast ${message.type}`}>
                        {message.text}
                    </div>
                )}

                {/* Edit Mode Banner */}
                {isEditMode && (
                    <div className="edit-mode-banner">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                        </svg>
                        <span>Modo de edição - você está editando o treino existente deste aluno</span>
                    </div>
                )}

                <div className="workout-form-container">
                    {/* Left Sidebar - Config */}
                    <div className="workout-config">
                        <h3 className="workout-config-title">Configurações</h3>

                        <div className="form-group">
                            <label className="form-label">Aluno</label>
                            {isLoading ? (
                                <select className="form-input" disabled>
                                    <option>Carregando...</option>
                                </select>
                            ) : students.length === 0 ? (
                                <div className="no-students-message">
                                    Nenhum aluno vinculado. O administrador da academia precisa atribuir alunos a você.
                                </div>
                            ) : (
                                <select
                                    className="form-input"
                                    value={selectedStudent}
                                    onChange={(e) => setSelectedStudent(e.target.value)}
                                    disabled={loadingWorkout}
                                >
                                    <option value="">Selecione um aluno</option>
                                    {students.map(student => (
                                        <option key={student.id} value={student.id}>
                                            {student.name} {student.has_workout ? '(já tem treino)' : ''}
                                        </option>
                                    ))}
                                </select>
                            )}
                            {loadingWorkout && (
                                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 'var(--spacing-2)' }}>
                                    Carregando treino existente...
                                </small>
                            )}
                        </div>

                        <div className="workout-days-nav">
                            <label className="form-label">Dias de Treino</label>
                            <div className="days-tabs">
                                {workoutDays.map((day, index) => (
                                    <button
                                        key={day.id}
                                        className={`day-tab ${activeDay === index ? 'active' : ''}`}
                                        onClick={() => setActiveDay(index)}
                                    >
                                        <span className="day-letter">Treino {day.day_label}</span>
                                        {day.day_name && (
                                            <span style={{ fontSize: '11px', color: activeDay === index ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                                                {day.day_name}
                                            </span>
                                        )}
                                        {workoutDays.length > 1 && (
                                            <span
                                                className="day-remove"
                                                onClick={(e) => { e.stopPropagation(); removeDay(index); }}
                                            >×</span>
                                        )}
                                    </button>
                                ))}
                                {workoutDays.length < 7 && (
                                    <button className="day-tab add-day" onClick={addDay}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content - Current Day */}
                    <div className="workout-exercises">
                        <div className="exercises-header">
                            <div className="current-day-info">
                                <span className="current-day-label">Treino {currentDay.day_label}</span>
                                <MuscleGroupDropdown
                                    value={currentDay.day_name}
                                    onChange={(name) => updateDayName(activeDay, name)}
                                />
                            </div>
                            {catalogExercises.length > 0 && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                        {catalogExercises.length} exercícios disponíveis
                                    </span>
                                    para sugestão automática
                                </div>
                            )}
                        </div>

                        <div className="exercise-list">
                            {currentDay.exercises.map((exercise, exIndex) => (
                                <div key={exercise.id} className="exercise-item">
                                    <div className="exercise-item-header">
                                        <span className="exercise-item-number">{exIndex + 1}</span>
                                        <ExerciseAutocomplete
                                            value={exercise.name}
                                            dayName={currentDay.day_name}
                                            onChange={(name) => updateExercise(activeDay, exIndex, 'name', name)}
                                        />
                                        <div className="exercise-item-actions">
                                            <button
                                                className="action-btn delete"
                                                onClick={() => removeExercise(activeDay, exIndex)}
                                                disabled={currentDay.exercises.length <= 1}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="exercise-details">
                                        <div className="exercise-detail-input">
                                            <span className="exercise-detail-label">Séries</span>
                                            <input
                                                type="number"
                                                className="exercise-detail-value"
                                                value={exercise.sets}
                                                min="1"
                                                onChange={(e) => updateExercise(activeDay, exIndex, 'sets', parseInt(e.target.value) || 1)}
                                            />
                                        </div>
                                        <div className="exercise-detail-input">
                                            <span className="exercise-detail-label">Repetições</span>
                                            <input
                                                type="text"
                                                className="exercise-detail-value"
                                                value={exercise.reps}
                                                placeholder="10-12"
                                                onChange={(e) => updateExercise(activeDay, exIndex, 'reps', e.target.value)}
                                            />
                                        </div>
                                        <div className="exercise-detail-input">
                                            <span className="exercise-detail-label">Descanso (s)</span>
                                            <input
                                                type="number"
                                                className="exercise-detail-value"
                                                value={exercise.rest}
                                                min="0"
                                                onChange={(e) => updateExercise(activeDay, exIndex, 'rest', parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="exercise-detail-input">
                                            <span className="exercise-detail-label">Carga</span>
                                            <input
                                                type="text"
                                                className="exercise-detail-value"
                                                value={exercise.load}
                                                placeholder="30kg"
                                                onChange={(e) => updateExercise(activeDay, exIndex, 'load', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button type="button" className="add-exercise-btn" onClick={() => addExercise(activeDay)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                </svg>
                                Adicionar Exercício
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ProfessorLayout>
    );
}
