import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../shared/components/layout';
import { getCurrentStudentId } from '../../../shared/services/student.service';
import { supabase } from '../../../shared/services/supabase';
import {
    createWorkoutDiary,
    getStudentDiaries,
    getDiaryWithExercises,
    deleteWorkoutDiary,
    type WorkoutDiary,
    type DiaryExercise,
    type CreateDiaryData
} from '../../../shared/services/workoutDiary.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../../../features/adminGlobal/styles/academias.css';
import '../styles/aluno.css';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';

interface ExerciseForm {
    exercise_name: string;
    sets: string;
    repetitions: string;
    weight: string;
    notes: string;
}

const blankExercise = (): ExerciseForm => ({ exercise_name: '', sets: '', repetitions: '', weight: '', notes: '' });

const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
const formatDateTime = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function DiarioTreino() {
    // IDs
    const [studentId, setStudentId] = useState<string | null>(null);
    const [academyId, setAcademyId] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [exercises, setExercises] = useState<ExerciseForm[]>([blankExercise()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // List state
    const [diaries, setDiaries] = useState<WorkoutDiary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Detail modal
    const [showDetail, setShowDetail] = useState(false);
    const [detailDiary, setDetailDiary] = useState<WorkoutDiary | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Messages
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Init
    useEffect(() => {
        const init = async () => {
            const sId = getCurrentStudentId();
            if (!sId) { setIsLoading(false); return; }
            setStudentId(sId);

            const { data: memberData } = await supabase
                .from('academy_users')
                .select('academy_id')
                .eq('user_id', sId)
                .limit(1)
                .single();
            const aId = memberData?.academy_id || null;
            if (!aId) { setIsLoading(false); return; }
            setAcademyId(aId);

            const res = await getStudentDiaries(sId, aId);
            if (res.success && res.data) setDiaries(res.data);
            setIsLoading(false);
        };
        init();
    }, []);

    useEffect(() => { if (message) { const t = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(t); } }, [message]);

    // Exercise helpers
    const updateExercise = (idx: number, field: keyof ExerciseForm, value: string) => {
        setExercises(prev => prev.map((ex, i) => i === idx ? { ...ex, [field]: value } : ex));
    };
    const addExercise = () => setExercises(prev => [...prev, blankExercise()]);
    const removeExercise = (idx: number) => {
        if (exercises.length === 1) return;
        setExercises(prev => prev.filter((_, i) => i !== idx));
    };

    // Submit
    const handleSave = async () => {
        if (!studentId || !academyId) return;
        if (!title.trim()) { setMessage({ type: 'error', text: 'Digite o nome do treino' }); return; }

        const validExercises = exercises.filter(e => e.exercise_name.trim());
        if (validExercises.length === 0) { setMessage({ type: 'error', text: 'Adicione pelo menos um exercício' }); return; }

        setIsSubmitting(true);
        const payload: CreateDiaryData = {
            academy_id: academyId,
            student_id: studentId,
            title: title.trim(),
            exercises: validExercises.map(e => ({
                exercise_name: e.exercise_name.trim(),
                sets: parseInt(e.sets) || 0,
                repetitions: parseInt(e.repetitions) || 0,
                weight: parseFloat(e.weight) || 0,
                notes: e.notes.trim() || undefined
            }))
        };

        const res = await createWorkoutDiary(payload);
        if (res.success) {
            setMessage({ type: 'success', text: '✅ Treino salvo no diário!' });
            setTitle('');
            setExercises([blankExercise()]);
            setShowForm(false);
            // Reload list
            const list = await getStudentDiaries(studentId, academyId);
            if (list.success && list.data) setDiaries(list.data);
        } else {
            setMessage({ type: 'error', text: res.error || 'Erro ao salvar' });
        }
        setIsSubmitting(false);
    };

    // Detail
    const openDetail = async (diary: WorkoutDiary) => {
        if (!academyId) return;
        setDetailLoading(true);
        setShowDetail(true);
        const res = await getDiaryWithExercises(diary.id, academyId);
        if (res.success && res.data) setDetailDiary(res.data);
        setDetailLoading(false);
    };

    const todayStr = new Date().toLocaleDateString('pt-BR');

    // Delete
    const handleDelete = async (diaryId: string) => {
        if (!academyId || !studentId) return;
        setIsDeleting(true);
        const res = await deleteWorkoutDiary(diaryId, academyId);
        if (res.success) {
            setMessage({ type: 'success', text: '🗑️ Registro excluído com sucesso' });
            setShowDetail(false);
            setDetailDiary(null);
            setConfirmDelete(null);
            const list = await getStudentDiaries(studentId, academyId);
            if (list.success && list.data) setDiaries(list.data);
        } else {
            setMessage({ type: 'error', text: res.error || 'Erro ao excluir' });
        }
        setIsDeleting(false);
    };

    // ─── Styles ───
    const cardStyle: React.CSSProperties = { background: 'var(--background-primary, #fff)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 'var(--spacing-4)' };
    const inputStyle: React.CSSProperties = { width: '100%', padding: 'var(--spacing-2) var(--spacing-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit' };
    const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, fontSize: 'var(--font-size-xs)', marginBottom: 'var(--spacing-1)', color: 'var(--text-secondary)', textTransform: 'uppercase' };
    const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 'var(--spacing-3)' };

    return (
        <DashboardLayout title="Diário de Treino" menuItems={menuItems}>
            <div style={{ padding: 0 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap', gap: 'var(--spacing-3)' }}>
                    <div>
                        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--spacing-1)' }}>📓 Diário de Treino</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Registre seus treinos e acompanhe sua evolução</p>
                    </div>
                    {!showForm && (
                        <button
                            className="btn-add"
                            onClick={() => setShowForm(true)}
                            style={{ fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                            </svg>
                            Novo Registro
                        </button>
                    )}
                </div>

                {/* Message */}
                {message && (
                    <div className={`message-toast ${message.type}`} style={{ marginBottom: 'var(--spacing-4)' }}>
                        {message.text}
                    </div>
                )}

                {isLoading ? (
                    <div className="loading-state"><div className="spinner"></div><p>Carregando...</p></div>
                ) : (
                    <>
                        {/* ═══ NEW DIARY FORM ═══ */}
                        {showForm && (
                            <div style={{ ...cardStyle, marginBottom: 'var(--spacing-6)', borderLeft: '4px solid var(--primary-500)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
                                    <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>📝 Novo Registro de Treino</h4>
                                    <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 20 }}>✕</button>
                                </div>

                                {/* Title + Date */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)', alignItems: 'end' }}>
                                    <div>
                                        <label style={labelStyle}>Nome do Treino *</label>
                                        <input
                                            style={inputStyle}
                                            placeholder="Ex: Treino de Peito e Tríceps"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Data</label>
                                        <div style={{ ...inputStyle, background: 'var(--background-secondary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', whiteSpace: 'nowrap' }}>
                                            📅 {todayStr}
                                        </div>
                                    </div>
                                </div>

                                {/* Exercise blocks */}
                                <div style={{ marginBottom: 'var(--spacing-3)' }}>
                                    <label style={{ ...labelStyle, fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-3)' }}>Exercícios</label>

                                    {exercises.map((ex, idx) => (
                                        <div key={idx} style={{
                                            background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)',
                                            padding: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)',
                                            border: '1px solid var(--border-color)', position: 'relative'
                                        }}>
                                            {/* Exercise header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
                                                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--primary-600)' }}>
                                                    Exercício {idx + 1}
                                                </span>
                                                {exercises.length > 1 && (
                                                    <button onClick={() => removeExercise(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-500)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                                                        ✕ Remover
                                                    </button>
                                                )}
                                            </div>

                                            {/* Name */}
                                            <div style={{ marginBottom: 'var(--spacing-2)' }}>
                                                <label style={labelStyle}>Nome do Exercício *</label>
                                                <input
                                                    style={inputStyle}
                                                    placeholder="Ex: Supino Reto"
                                                    value={ex.exercise_name}
                                                    onChange={e => updateExercise(idx, 'exercise_name', e.target.value)}
                                                />
                                            </div>

                                            {/* Sets / Reps / Weight */}
                                            <div style={gridStyle}>
                                                <div>
                                                    <label style={labelStyle}>Séries</label>
                                                    <input
                                                        style={inputStyle}
                                                        type="number" min="0" placeholder="4"
                                                        value={ex.sets}
                                                        onChange={e => updateExercise(idx, 'sets', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>Repetições</label>
                                                    <input
                                                        style={inputStyle}
                                                        type="number" min="0" placeholder="12"
                                                        value={ex.repetitions}
                                                        onChange={e => updateExercise(idx, 'repetitions', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>Carga (kg)</label>
                                                    <input
                                                        style={inputStyle}
                                                        type="number" min="0" step="0.5" placeholder="60"
                                                        value={ex.weight}
                                                        onChange={e => updateExercise(idx, 'weight', e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Notes */}
                                            <div style={{ marginTop: 'var(--spacing-2)' }}>
                                                <label style={labelStyle}>Observações</label>
                                                <input
                                                    style={inputStyle}
                                                    placeholder="Ex: Aumentar 5kg na próxima"
                                                    value={ex.notes}
                                                    onChange={e => updateExercise(idx, 'notes', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add exercise button */}
                                    <button
                                        onClick={addExercise}
                                        style={{
                                            width: '100%', padding: 'var(--spacing-2)',
                                            borderRadius: 'var(--radius-md)', border: '2px dashed var(--border-color)',
                                            background: 'transparent', color: 'var(--primary-500)',
                                            cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-1)',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                                        Adicionar Exercício
                                    </button>
                                </div>

                                {/* Save button */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)' }}>
                                    <button className="btn-cancel" onClick={() => { setShowForm(false); setTitle(''); setExercises([blankExercise()]); }}>Cancelar</button>
                                    <button
                                        className="btn-submit"
                                        onClick={handleSave}
                                        disabled={isSubmitting || !title.trim() || exercises.every(e => !e.exercise_name.trim())}
                                        style={{ fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-2) var(--spacing-5)' }}
                                    >
                                        {isSubmitting ? 'Salvando...' : '💾 Salvar no Diário'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ═══ DIARY LIST ═══ */}
                        <div>
                            <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, marginBottom: 'var(--spacing-4)' }}>
                                📚 Treinos Registrados ({diaries.length})
                            </h4>

                            {diaries.length === 0 ? (
                                <div className="empty-state" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                                    <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                                        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                    </svg>
                                    <h3>Nenhum treino registrado</h3>
                                    <p>Comece registrando seu primeiro treino para acompanhar sua evolução!</p>
                                    {!showForm && (
                                        <button className="btn-add" onClick={() => setShowForm(true)} style={{ marginTop: 'var(--spacing-3)' }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
                                            Registrar Primeiro Treino
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                                    {diaries.map(diary => (
                                        <div
                                            key={diary.id}
                                            onClick={() => openDetail(diary)}
                                            style={{
                                                ...cardStyle, cursor: 'pointer',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                transition: 'box-shadow 0.15s, border-color 0.15s',
                                                gap: 'var(--spacing-3)'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-300)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)', minWidth: 0 }}>
                                                <div style={{
                                                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                                    background: 'linear-gradient(135deg, var(--primary-100), var(--primary-200))',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 20, flexShrink: 0
                                                }}>
                                                    🏋️
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {diary.title}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                        📅 Registrado em {formatDate(diary.created_at)}
                                                    </div>
                                                </div>
                                            </div>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-secondary)" style={{ flexShrink: 0 }}>
                                                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                                            </svg>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ═══ DETAIL MODAL ═══ */}
                {showDetail && (
                    <div className="modal-overlay" onClick={() => { setShowDetail(false); setDetailDiary(null); }}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '95%' }}>
                            <div className="modal-header">
                                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                    🏋️ {detailDiary?.title || 'Carregando...'}
                                </h3>
                                <button className="modal-close" onClick={() => { setShowDetail(false); setDetailDiary(null); }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                                </button>
                            </div>
                            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                                {detailLoading ? (
                                    <div className="loading-state"><div className="spinner"></div></div>
                                ) : detailDiary ? (
                                    <>
                                        <div style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-2) var(--spacing-3)', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                            📅 {formatDateTime(detailDiary.created_at)}
                                        </div>

                                        {(() => {
                                            const allExercises = detailDiary.exercises || [];
                                            // Group by exercise_name preserving order
                                            const grouped: { name: string; sets: DiaryExercise[] }[] = [];
                                            const map = new Map<string, DiaryExercise[]>();
                                            for (const ex of allExercises) {
                                                const key = ex.exercise_name;
                                                if (!map.has(key)) {
                                                    const arr: DiaryExercise[] = [];
                                                    map.set(key, arr);
                                                    grouped.push({ name: key, sets: arr });
                                                }
                                                map.get(key)!.push(ex);
                                            }

                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                                                    {grouped.map((group, gi) => {
                                                        const hasSetDetails = group.sets.some(s => s.set_number != null);
                                                        const totalVolume = group.sets.reduce((sum, s) => sum + s.repetitions * s.weight, 0);

                                                        return (
                                                            <div key={gi} style={{
                                                                borderRadius: 'var(--radius-md)',
                                                                border: '1px solid var(--border-color)',
                                                                overflow: 'hidden'
                                                            }}>
                                                                {/* Exercise header */}
                                                                <div style={{
                                                                    background: 'linear-gradient(135deg, var(--primary-50), var(--primary-100))',
                                                                    padding: 'var(--spacing-2) var(--spacing-3)',
                                                                    borderBottom: '1px solid var(--border-color)',
                                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                    flexWrap: 'wrap', gap: '4px'
                                                                }}>
                                                                    <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--primary-700)' }}>
                                                                        {gi + 1}. {group.name}
                                                                    </strong>
                                                                    <div style={{ display: 'flex', gap: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                                        <span>{group.sets.length} {group.sets.length === 1 ? 'série' : 'séries'}</span>
                                                                        {totalVolume > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>📊 {totalVolume.toLocaleString('pt-BR')} kg vol.</span>}
                                                                    </div>
                                                                </div>

                                                                {/* Per-set details table */}
                                                                {hasSetDetails ? (
                                                                    <div style={{ overflowX: 'auto' }}>
                                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                                                                            <thead>
                                                                                <tr style={{ background: 'var(--background-secondary)' }}>
                                                                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Série</th>
                                                                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Reps</th>
                                                                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Carga</th>
                                                                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Descanso</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {group.sets.map((s, si) => (
                                                                                    <tr key={s.id} style={{ borderTop: si > 0 ? '1px solid var(--border-color)' : undefined }}>
                                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--primary-600)' }}>{s.set_number ?? si + 1}</td>
                                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{s.repetitions}</td>
                                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: '#f59e0b' }}>{s.weight} {s.unit}</td>
                                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                                                            {s.rest_seconds != null && s.rest_seconds > 0 ? `${s.rest_seconds}s` : '—'}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    /* Fallback: old aggregate format */
                                                                    <div style={{ padding: 'var(--spacing-3)' }}>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-3)', textAlign: 'center' }}>
                                                                            <div>
                                                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 2 }}>Séries</div>
                                                                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--primary-600)' }}>{group.sets[0]?.sets ?? '—'}</div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 2 }}>Repetições</div>
                                                                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: 'var(--primary-600)' }}>{group.sets[0]?.repetitions ?? '—'}</div>
                                                                            </div>
                                                                            <div>
                                                                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 2 }}>Carga</div>
                                                                                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', color: '#f59e0b' }}>{group.sets[0]?.weight ?? '—'} {group.sets[0]?.unit}</div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Notes */}
                                                                {group.sets.some(s => s.notes) && (
                                                                    <div style={{
                                                                        padding: 'var(--spacing-2) var(--spacing-3)',
                                                                        borderTop: '1px solid var(--border-color)',
                                                                        background: 'var(--background-secondary)',
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        color: 'var(--text-secondary)',
                                                                        fontStyle: 'italic'
                                                                    }}>
                                                                        💬 {group.sets.find(s => s.notes)?.notes}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}

                                        {(!detailDiary.exercises || detailDiary.exercises.length === 0) && (
                                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--spacing-4)' }}>
                                                Nenhum exercício registrado
                                            </div>
                                        )}
                                    </>
                                ) : null}
                            </div>
                            {/* Delete button */}
                            {detailDiary && !detailLoading && (
                                <div style={{ padding: 'var(--spacing-3) var(--spacing-4)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    {confirmDelete === detailDiary.id ? (
                                        <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', width: '100%' }}>
                                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', flex: 1 }}>Tem certeza? Esta ação não pode ser desfeita.</span>
                                            <button
                                                onClick={() => setConfirmDelete(null)}
                                                style={{
                                                    padding: 'var(--spacing-1) var(--spacing-3)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--background-primary)',
                                                    cursor: 'pointer',
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 600
                                                }}
                                            >Cancelar</button>
                                            <button
                                                onClick={() => handleDelete(detailDiary.id)}
                                                disabled={isDeleting}
                                                style={{
                                                    padding: 'var(--spacing-1) var(--spacing-3)',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: 'none',
                                                    background: '#ef4444',
                                                    color: '#fff',
                                                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 600,
                                                    opacity: isDeleting ? 0.6 : 1
                                                }}
                                            >{isDeleting ? 'Excluindo...' : 'Confirmar'}</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setConfirmDelete(detailDiary.id)}
                                            style={{
                                                padding: 'var(--spacing-1) var(--spacing-3)',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid #ef4444',
                                                background: 'transparent',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--spacing-1)',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            🗑️ Excluir Registro
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
