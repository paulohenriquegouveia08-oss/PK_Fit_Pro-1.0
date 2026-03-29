import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlunoLayout } from '../../../shared/components/layout';
import { getCurrentStudentId } from '../../../shared/services/student.service';
import { createWorkout, getStudentWorkout, updateWorkout, type Exercise, type WorkoutDay } from '../../../shared/services/workout.service';
import { allMuscleGroups, getExercisesForDayName } from '../../../shared/data/exerciseCatalog';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../../professor/styles/professor.css';
import '../../professor/styles/exerciseCatalog.css';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';

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
export default function CriarMeuTreino() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([createEmptyDay('A')]);
    const [activeDay, setActiveDay] = useState(0);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

    // Context Data
    const [studentId, setStudentId] = useState<string | null>(null);

    // Edit mode state
    const [isEditMode, setIsEditMode] = useState(false);
    const [existingWorkoutId, setExistingWorkoutId] = useState<string | null>(null);
    const [loadingWorkout, setLoadingWorkout] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            const currentId = getCurrentStudentId();
            if (currentId) {
                setStudentId(currentId);

                // Note: We used to store professorId here, but student-created workouts 
                // always use the student's own ID as the creator.

                // Load existing workout
                setLoadingWorkout(true);
                const result = await getStudentWorkout(currentId);

                if (result.success && result.data && result.data.days && result.data.days.length > 0) {
                    setIsEditMode(true);
                    setExistingWorkoutId(result.data.id);
                    setWorkoutDays(result.data.days);
                    setActiveDay(0);
                } else {
                    setIsEditMode(false);
                    setExistingWorkoutId(null);
                    setWorkoutDays([createEmptyDay('A')]);
                    setActiveDay(0);
                }
                setLoadingWorkout(false);
            }
            setIsLoading(false);
        };
        loadInitialData();
    }, []);

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

    const handleDragStart = (e: React.DragEvent, exIndex: number) => {
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', exIndex.toString());
        }
        setDraggedItemIndex(exIndex);
    };

    const handleDragOver = (e: React.DragEvent, exIndex: number) => {
        e.preventDefault();
        if (draggedItemIndex === null) return;
        if (draggedItemIndex === exIndex) return;

        const newDays = [...workoutDays];
        const day = newDays[activeDay];
        const exercises = [...day.exercises];

        const draggedEx = exercises[draggedItemIndex];
        exercises.splice(draggedItemIndex, 1);
        exercises.splice(exIndex, 0, draggedEx);

        day.exercises = exercises;
        setWorkoutDays(newDays);
        setDraggedItemIndex(exIndex);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
    };

    const moveExercise = (dayIndex: number, exIndex: number, direction: 'up' | 'down') => {
        const newDays = [...workoutDays];
        const exercises = [...newDays[dayIndex].exercises];

        if (direction === 'up' && exIndex > 0) {
            const temp = exercises[exIndex];
            exercises[exIndex] = exercises[exIndex - 1];
            exercises[exIndex - 1] = temp;
        } else if (direction === 'down' && exIndex < exercises.length - 1) {
            const temp = exercises[exIndex];
            exercises[exIndex] = exercises[exIndex + 1];
            exercises[exIndex + 1] = temp;
        } else {
            return;
        }

        newDays[dayIndex].exercises = exercises;
        setWorkoutDays(newDays);
    };

    const handleSave = async () => {
        if (!studentId) {
            setMessage({ type: 'error', text: 'Erro ao identificar usuário!' });
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

        setIsSaving(true);
        setMessage(null);

        let result;

        if (isEditMode && existingWorkoutId) {
            // Update existing workout
            result = await updateWorkout(existingWorkoutId, workoutDays.map(day => ({
                day_label: day.day_label,
                day_name: day.day_name,
                exercises: day.exercises
            })), studentId, studentId);
        } else {
            // Create new private workout. 
            result = await createWorkout({
                student_id: studentId,
                professor_id: studentId,
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
                text: 'Meu treino foi salvo com sucesso!'
            });

            setTimeout(() => {
                navigate('/aluno');
            }, 1000);
        } else {
            setMessage({ type: 'error', text: result.error || 'Erro ao salvar treino' });
        }

        setIsSaving(false);
    };

    const currentDay = workoutDays[activeDay];
    const catalogExercises = getExercisesForDayName(currentDay?.day_name || '');

    if (isLoading) {
        return (
            <AlunoLayout title="Criar Meu Treino" menuItems={menuItems}>
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Carregando...</p>
                </div>
            </AlunoLayout>
        );
    }

    return (
        <AlunoLayout title={isEditMode ? 'Editar Meu Treino' : 'Criar Meu Treino'} menuItems={menuItems}>
            <div className="criar-treino-page">
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
                    <h2>{isEditMode ? 'Editar Meu Treino' : 'Criar Nova Ficha'}</h2>
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

                <div className="edit-mode-banner" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.2)', marginBottom: 'var(--spacing-6)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                    <span><strong>Você está no modo de criação manual.</strong> Monte sua própria ficha adicionando os dias da semana e os exercícios desejados em cada dia.</span>
                </div>

                <div className="workout-form-container">
                    {/* Left Sidebar - Config */}
                    <div className="workout-config">
                        <div className="workout-days-nav">
                            <label className="form-label" style={{ marginBottom: '12px', display: 'block', fontWeight: 600 }}>Dias de Treino</label>
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
                                    <button className="day-tab add-day" onClick={addDay} style={{ background: 'rgba(255,255,255,0.05)' }}>
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
                        {currentDay && (
                            <>
                                <div className="exercises-header">
                                    <div className="current-day-info">
                                        <span className="current-day-label" style={{ fontWeight: 600 }}>Treino {currentDay.day_label}</span>
                                        <MuscleGroupDropdown
                                            value={currentDay.day_name}
                                            onChange={(name) => updateDayName(activeDay, name)}
                                        />
                                    </div>
                                    {catalogExercises.length > 0 && (
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ background: 'var(--primary-50)', color: 'var(--primary-700)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                                {catalogExercises.length} exercícios disponíveis
                                            </span>
                                            para sugestão automática
                                        </div>
                                    )}
                                </div>

                                <div className="exercise-list">
                                    {currentDay.exercises.map((exercise, exIndex) => (
                                        <div
                                            key={exercise.id}
                                            className="exercise-item"
                                            style={{
                                                background: 'var(--bg-secondary)',
                                                padding: 'var(--spacing-4)',
                                                borderRadius: '12px',
                                                marginBottom: 'var(--spacing-4)',
                                                border: '1px solid var(--border-color)',
                                                opacity: draggedItemIndex === exIndex ? 0.5 : 1,
                                                transform: draggedItemIndex === exIndex ? 'scale(0.98)' : 'none',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                flexDirection: 'column'
                                            }}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, exIndex)}
                                            onDragOver={(e) => handleDragOver(e, exIndex)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <div className="exercise-item-header" style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                                                {/* Drag Handle and Order Arrows */}
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                                    <button type="button" onClick={() => moveExercise(activeDay, exIndex, 'up')} disabled={exIndex === 0} style={{ background: 'none', border: 'none', color: exIndex === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-secondary)', cursor: exIndex === 0 ? 'default' : 'pointer', padding: 0 }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                                                        </svg>
                                                    </button>

                                                    <div style={{ cursor: 'grab', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'center' }}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                                        </svg>
                                                    </div>

                                                    <button type="button" onClick={() => moveExercise(activeDay, exIndex, 'down')} disabled={exIndex === currentDay.exercises.length - 1} style={{ background: 'none', border: 'none', color: exIndex === currentDay.exercises.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-secondary)', cursor: exIndex === currentDay.exercises.length - 1 ? 'default' : 'pointer', padding: 0 }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                                                        </svg>
                                                    </button>
                                                </div>

                                                <span className="exercise-item-number" style={{ background: 'var(--primary-color)', color: 'white', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>{exIndex + 1}</span>
                                                <div style={{ flex: 1 }}>
                                                    <ExerciseAutocomplete
                                                        value={exercise.name}
                                                        dayName={currentDay.day_name}
                                                        onChange={(name) => updateExercise(activeDay, exIndex, 'name', name)}
                                                    />
                                                </div>
                                                <div className="exercise-item-actions">
                                                    <button
                                                        className="action-btn delete"
                                                        onClick={() => removeExercise(activeDay, exIndex)}
                                                        disabled={currentDay.exercises.length <= 1}
                                                        style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="exercise-details" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginTop: '16px' }}>
                                                <div className="exercise-detail-input">
                                                    <span className="exercise-detail-label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Séries</span>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={exercise.sets}
                                                        min="1"
                                                        onChange={(e) => updateExercise(activeDay, exIndex, 'sets', parseInt(e.target.value) || 1)}
                                                    />
                                                </div>
                                                <div className="exercise-detail-input">
                                                    <span className="exercise-detail-label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Repetições</span>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={exercise.reps}
                                                        placeholder="10-12"
                                                        onChange={(e) => updateExercise(activeDay, exIndex, 'reps', e.target.value)}
                                                    />
                                                </div>
                                                <div className="exercise-detail-input">
                                                    <span className="exercise-detail-label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Descanso (s)</span>
                                                    <input
                                                        type="number"
                                                        className="form-input"
                                                        value={exercise.rest}
                                                        min="0"
                                                        onChange={(e) => updateExercise(activeDay, exIndex, 'rest', parseInt(e.target.value) || 0)}
                                                    />
                                                </div>
                                                <div className="exercise-detail-input">
                                                    <span className="exercise-detail-label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Carga Inicial</span>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={exercise.load}
                                                        placeholder="Ex: 10kg"
                                                        onChange={(e) => updateExercise(activeDay, exIndex, 'load', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button type="button" className="add-exercise-btn" onClick={() => addExercise(activeDay)} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                        </svg>
                                        Adicionar Exercício
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </AlunoLayout>
    );
}
