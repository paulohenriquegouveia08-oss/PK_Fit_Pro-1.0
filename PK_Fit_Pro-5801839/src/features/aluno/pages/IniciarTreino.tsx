import { useState, useEffect, useRef, useCallback } from 'react';
import { AlunoLayout } from '../../../shared/components/layout';
import { getCurrentStudentId } from '../../../shared/services/student.service';
import { getStudentWorkout, type Workout, type WorkoutDay, type Exercise } from '../../../shared/services/workout.service';
import { createWorkoutDiary, type CreateDiaryData } from '../../../shared/services/workoutDiary.service';
import { supabase } from '../../../shared/services/supabase';
import {
    startSession,
    logSet,
    finishSession,
    getLastSessionForDay,
    getSessionHistory,
    type WorkoutSession,
    type SetLog,
    type LogSetData
} from '../../../shared/services/workoutSession.service';
import '../../../features/adminGlobal/styles/dashboard.css';
import '../styles/aluno.css';
import { alunoMenuItems as menuItems } from '../../../shared/config/alunoMenu';

// ─── Types ────────────────────────────────────────────
type Screen = 'selection' | 'countdown' | 'execution' | 'rest' | 'summary';

interface SessionState {
    sessionId: string;
    workout: Workout;
    day: WorkoutDay;
    exerciseIndex: number;
    setIndex: number; // 0-based
    startedAt: number; // Date.now()
    setsCompleted: { exerciseId: string; exerciseName: string; reps: number; load: number; setNumber: number; restUsed: number }[];
}

interface PersistedSession {
    session: SessionState;
    screen: Screen;
    restTargetRef: number;
    restStartRef: number;
    repsInput: string;
    loadInput: string;
}

const SESSION_KEY = 'pk_active_workout_session';

// ─── Helpers ──────────────────────────────────────────
const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const parseLoad = (load: string): number => {
    const num = parseFloat(load.replace(/[^0-9.,]/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
};

// Extrai o mínimo de reps de strings como "10-12", "10", "8-10"
const parseMinReps = (reps: string): number => {
    if (!reps) return 0;
    const match = reps.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
};

// ─── Component ────────────────────────────────────────
export default function IniciarTreino() {
    const [studentId, setStudentId] = useState<string | null>(null);
    const [academyId, setAcademyId] = useState<string | null>(null);
    const [workout, setWorkout] = useState<Workout | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [screen, setScreen] = useState<Screen>('selection');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Session state
    const [session, setSession] = useState<SessionState | null>(null);
    const [history, setHistory] = useState<WorkoutSession[]>([]);
    const [prevSession, setPrevSession] = useState<{ session: WorkoutSession; sets: SetLog[] } | null>(null);

    // Countdown
    const [countdownNum, setCountdownNum] = useState(3);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Execution
    const [repsInput, setRepsInput] = useState('0');
    const [loadInput, setLoadInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [diaryComment, setDiaryComment] = useState('');

    // Rest timer (timestamp-based)
    const restTargetRef = useRef(0); // target end time (Date.now())
    const restStartRef = useRef(0);  // when rest started (Date.now())
    const [restRemaining, setRestRemaining] = useState(0);
    const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Elapsed timer
    const [elapsed, setElapsed] = useState(0);
    const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Summary
    const [summaryData, setSummaryData] = useState<{
        duration: number;
        volume: number;
        totalSets: number;
        totalExercises: number;
        prevVolume: number | null;
        completedSets: { exerciseId: string; exerciseName: string; reps: number; load: number; setNumber: number; restUsed: number }[];
        dayLabel: string;
        dayName: string;
    } | null>(null);

    // Modals
    const [isReordering, setIsReordering] = useState(false);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);

    // Emergency persistence ref (always has latest state for pagehide/beforeunload)
    const persistRef = useRef<PersistedSession | null>(null);

    // Screen Wake Lock to keep device awake during workout
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // ─── Init ─────────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            const sId = getCurrentStudentId();
            if (!sId) { setIsLoading(false); return; }
            setStudentId(sId);

            // Get academy_id for diary integration
            const { data: memberData } = await supabase
                .from('academy_users')
                .select('academy_id')
                .eq('user_id', sId)
                .limit(1)
                .single();
            if (memberData?.academy_id) setAcademyId(memberData.academy_id);

            const res = await getStudentWorkout(sId);
            if (res.success && res.data) {
                setWorkout(res.data);
            }

            const hist = await getSessionHistory(sId, 10);
            if (hist.success && hist.data) setHistory(hist.data);

            // ─── Restore Session ───────────────
            try {
                const stored = localStorage.getItem(SESSION_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored) as PersistedSession;
                    if (parsed.session && parsed.screen && parsed.session.sessionId) {
                        setSession(parsed.session);
                        setScreen(parsed.screen);
                        restTargetRef.current = parsed.restTargetRef || 0;
                        restStartRef.current = parsed.restStartRef || 0;
                        setRepsInput(parsed.repsInput || '');
                        setLoadInput(parsed.loadInput || '');

                        // Restart timers if in an active state
                        if (parsed.screen === 'execution' || parsed.screen === 'rest') {
                            if (elapsedRef.current) clearInterval(elapsedRef.current);
                            elapsedRef.current = setInterval(() => {
                                setSession(prev => {
                                    if (!prev) return prev;
                                    setElapsed(Math.floor((Date.now() - prev.startedAt) / 1000));
                                    return prev;
                                });
                            }, 1000);
                        }

                        if (parsed.screen === 'rest') {
                            const now = Date.now();
                            const remaining = Math.max(0, Math.ceil((restTargetRef.current - now) / 1000));
                            setRestRemaining(remaining);

                            if (remaining > 0) {
                                if (restRef.current) clearInterval(restRef.current);
                                restRef.current = setInterval(() => {
                                    const rem = Math.max(0, Math.ceil((restTargetRef.current - Date.now()) / 1000));
                                    setRestRemaining(rem);
                                    if (rem <= 0) {
                                        if (restRef.current) clearInterval(restRef.current);
                                        setSession(prev => {
                                            if (!prev) return prev;
                                            const sets = [...prev.setsCompleted];
                                            if (sets.length > 0) {
                                                sets[sets.length - 1] = { ...sets[sets.length - 1], restUsed: Math.round((Date.now() - restStartRef.current) / 1000) };
                                            }
                                            return { ...prev, setsCompleted: sets };
                                        });
                                        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                                        setScreen('execution');
                                    }
                                }, 200);
                            } else {
                                // Time already elapsed while closed
                                setSession(prev => {
                                    if (!prev) return prev;
                                    const sets = [...prev.setsCompleted];
                                    if (sets.length > 0) {
                                        sets[sets.length - 1] = { ...sets[sets.length - 1], restUsed: Math.round((parsed.restTargetRef - parsed.restStartRef) / 1000) };
                                    }
                                    return { ...prev, setsCompleted: sets };
                                });
                                setScreen('execution');
                            }
                        }

                        setIsLoading(false);
                        return; // Successfully restored
                    }
                }
            } catch (err) {
                console.error('Error parsing session state:', err);
                localStorage.removeItem(SESSION_KEY);
            }

            setIsLoading(false);
        };
        init();
        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (restRef.current) clearInterval(restRef.current);
            if (elapsedRef.current) clearInterval(elapsedRef.current);
        };
    }, []);

    useEffect(() => {
        if (message) { const t = setTimeout(() => setMessage(null), 4000); return () => clearTimeout(t); }
    }, [message]);

    // ─── Persistence Sync & Visibility API ────────────
    // Keep persistRef always up-to-date for emergency saves
    useEffect(() => {
        if (!session) { persistRef.current = null; return; }
        const persist: PersistedSession = {
            session,
            screen,
            restTargetRef: restTargetRef.current,
            restStartRef: restStartRef.current,
            repsInput,
            loadInput
        };
        persistRef.current = persist;
        localStorage.setItem(SESSION_KEY, JSON.stringify(persist));
    }, [session, screen, repsInput, loadInput]);

    // Emergency save on pagehide / beforeunload / freeze
    // These events fire right BEFORE the OS kills the tab on mobile
    useEffect(() => {
        const emergencySave = () => {
            if (persistRef.current) {
                // Always update refs to latest values
                persistRef.current.restTargetRef = restTargetRef.current;
                persistRef.current.restStartRef = restStartRef.current;
                try {
                    localStorage.setItem(SESSION_KEY, JSON.stringify(persistRef.current));
                } catch (_e) { /* localStorage full, nothing we can do */ }
            }
        };
        // pagehide is the most reliable on mobile (fires even when tab is killed)
        window.addEventListener('pagehide', emergencySave);
        window.addEventListener('beforeunload', emergencySave);
        // freeze is for Page Lifecycle API (Chrome mobile)
        document.addEventListener('freeze', emergencySave);

        return () => {
            window.removeEventListener('pagehide', emergencySave);
            window.removeEventListener('beforeunload', emergencySave);
            document.removeEventListener('freeze', emergencySave);
        };
    }, []); // empty deps — uses refs internally

    // Visibility change: sync timers AND re-acquire wake lock
    useEffect(() => {
        const handleVisibility = async () => {
            if (document.visibilityState === 'visible') {
                // Recalculate rest timer (catches up after background sleep)
                if (screen === 'rest') {
                    const remaining = Math.max(0, Math.ceil((restTargetRef.current - Date.now()) / 1000));
                    setRestRemaining(remaining);
                    if (remaining <= 0) {
                        if (restRef.current) clearInterval(restRef.current);
                        setSession(prev => {
                            if (!prev) return prev;
                            const sets = [...prev.setsCompleted];
                            if (sets.length > 0) {
                                sets[sets.length - 1] = { ...sets[sets.length - 1], restUsed: Math.round((Date.now() - restStartRef.current) / 1000) };
                            }
                            return { ...prev, setsCompleted: sets };
                        });
                        setScreen('execution');
                    }
                }
                // Recalculate elapsed timer
                if (session) {
                    setElapsed(Math.floor((Date.now() - session.startedAt) / 1000));
                }
                // Re-acquire Screen Wake Lock (it's released when page becomes hidden)
                if ('wakeLock' in navigator && (screen === 'execution' || screen === 'rest')) {
                    try {
                        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                    } catch (_e) { /* device doesn't support or user denied */ }
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [screen, session]);

    // Screen Wake Lock: keep screen awake during active workout
    useEffect(() => {
        if (screen !== 'execution' && screen !== 'rest') {
            // Release wake lock when not in active workout
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(() => { });
                wakeLockRef.current = null;
            }
            return;
        }
        const acquireWakeLock = async () => {
            if ('wakeLock' in navigator) {
                try {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                } catch (_e) { /* not supported or denied */ }
            }
        };
        acquireWakeLock();
        return () => {
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(() => { });
                wakeLockRef.current = null;
            }
        };
    }, [screen]);

    // ─── Elapsed Timer ────────────────────────────────
    const startElapsedTimer = useCallback(() => {
        if (elapsedRef.current) clearInterval(elapsedRef.current);
        elapsedRef.current = setInterval(() => {
            setSession(prev => {
                if (!prev) return prev;
                setElapsed(Math.floor((Date.now() - prev.startedAt) / 1000));
                return prev;
            });
        }, 1000);
    }, []);

    // ─── Select Day ───────────────────────────────────
    const handleSelectDay = async (day: WorkoutDay) => {
        if (!studentId || !workout) return;

        // Fetch previous session for comparison
        const prev = await getLastSessionForDay(studentId, day.id);
        if (prev.success && prev.data) setPrevSession(prev.data);

        setScreen('countdown');
        setCountdownNum(3);

        // Start countdown
        let count = 3;
        countdownRef.current = setInterval(async () => {
            count--;
            setCountdownNum(count);
            if (count <= 0) {
                if (countdownRef.current) clearInterval(countdownRef.current);

                // Create session in DB
                const res = await startSession(studentId, workout.id, day.id);
                if (!res.success || !res.data) {
                    setMessage({ type: 'error', text: 'Erro ao iniciar sessão' });
                    setScreen('selection');
                    return;
                }

                const newSession: SessionState = {
                    sessionId: res.data.id,
                    workout,
                    day,
                    exerciseIndex: 0,
                    setIndex: 0,
                    startedAt: Date.now(),
                    setsCompleted: []
                };
                setSession(newSession);

                // Pre-fill suggested values
                const firstEx = day.exercises[0];
                if (firstEx) {
                    setRepsInput(String(parseMinReps(firstEx.reps)));
                    setLoadInput(firstEx.load || '');
                }

                setScreen('execution');
                startElapsedTimer();
            }
        }, 1000);
    };

    // ─── Current Exercise & Set ───────────────────────
    const currentExercise: Exercise | null =
        session ? session.day.exercises[session.exerciseIndex] || null : null;

    const totalSetsForCurrentExercise = currentExercise?.sets || 0;
    const currentSetDisplay = session ? session.setIndex + 1 : 0;

    // ─── Finish Set ───────────────────────────────────
    const handleFinishSet = async () => {
        if (!session || !currentExercise) return;
        setIsSaving(true);

        const repsDone = parseInt(repsInput) || 0;
        const loadDone = parseLoad(loadInput);

        // Log to DB
        const logData: LogSetData = {
            session_id: session.sessionId,
            exercise_id: currentExercise.id,
            exercise_name: currentExercise.name,
            set_number: session.setIndex + 1,
            reps_target: currentExercise.reps,
            reps_done: repsDone,
            load_target: currentExercise.load,
            load_done: loadDone,
            rest_seconds_target: currentExercise.rest,
            rest_seconds_used: 0 // Will be updated after rest
        };

        const res = await logSet(logData);
        if (!res.success) {
            setMessage({ type: 'error', text: 'Erro ao salvar série' });
            setIsSaving(false);
            return;
        }

        // Track locally
        const updatedSets = [
            ...session.setsCompleted,
            { exerciseId: currentExercise.id, exerciseName: currentExercise.name, reps: repsDone, load: loadDone, setNumber: session.setIndex + 1, restUsed: 0 }
        ];

        const nextSetIndex = session.setIndex + 1;
        const isLastSet = nextSetIndex >= totalSetsForCurrentExercise;
        const nextExerciseIndex = isLastSet ? session.exerciseIndex + 1 : session.exerciseIndex;
        const isLastExercise = nextExerciseIndex >= session.day.exercises.length;

        if (isLastExercise && isLastSet) {
            // FINISH SESSION
            await finishWorkout(updatedSets);
        } else {
            // Update session state
            const updated: SessionState = {
                ...session,
                setIndex: isLastSet ? 0 : nextSetIndex,
                exerciseIndex: nextExerciseIndex,
                setsCompleted: updatedSets
            };
            setSession(updated);

            // Pre-fill next exercise values
            const nextEx = session.day.exercises[nextExerciseIndex];
            if (nextEx) {
                setRepsInput(String(parseMinReps(nextEx.reps)));
                setLoadInput(nextEx.load || '');
            }

            // Start rest timer
            const restSec = currentExercise.rest || 60;
            const now = Date.now();
            const targetEnd = now + restSec * 1000;
            restTargetRef.current = targetEnd;
            restStartRef.current = now;
            setRestRemaining(restSec);
            setScreen('rest');

            if (restRef.current) clearInterval(restRef.current);
            restRef.current = setInterval(() => {
                const remaining = Math.max(0, Math.ceil((restTargetRef.current - Date.now()) / 1000));
                setRestRemaining(remaining);
                if (remaining <= 0) {
                    if (restRef.current) clearInterval(restRef.current);
                    // Record actual rest used on last set
                    setSession(prev => {
                        if (!prev) return prev;
                        const sets = [...prev.setsCompleted];
                        if (sets.length > 0) {
                            sets[sets.length - 1] = { ...sets[sets.length - 1], restUsed: Math.round((Date.now() - restStartRef.current) / 1000) };
                        }
                        return { ...prev, setsCompleted: sets };
                    });
                    // Vibrate
                    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                    setScreen('execution');
                }
            }, 200);
        }
        setIsSaving(false);
    };

    // ─── Rest Adjustments ─────────────────────────────
    const adjustRest = (delta: number) => {
        const newTarget = restTargetRef.current + delta * 1000;
        restTargetRef.current = newTarget;
        const newRemaining = Math.max(0, Math.ceil((newTarget - Date.now()) / 1000));
        setRestRemaining(newRemaining);
    };

    const skipRest = () => {
        if (restRef.current) clearInterval(restRef.current);
        // Record actual rest used on last set
        setSession(prev => {
            if (!prev) return prev;
            const sets = [...prev.setsCompleted];
            if (sets.length > 0) {
                sets[sets.length - 1] = { ...sets[sets.length - 1], restUsed: Math.round((Date.now() - restStartRef.current) / 1000) };
            }
            return { ...prev, setsCompleted: sets };
        });
        setScreen('execution');
    };

    // ─── Finish Workout ───────────────────────────────
    const finishWorkout = async (completedSets: { exerciseId: string; exerciseName: string; reps: number; load: number; setNumber: number; restUsed: number }[]) => {
        if (!session) return;
        if (elapsedRef.current) clearInterval(elapsedRef.current);

        const duration = Math.floor((Date.now() - session.startedAt) / 1000);
        const volume = completedSets.reduce((sum, s) => sum + s.reps * s.load, 0);
        const uniqueExercises = new Set(completedSets.map(s => s.exerciseId)).size;

        const metrics = {
            total_duration_seconds: duration,
            total_volume: volume,
            total_sets: completedSets.length,
            total_exercises: uniqueExercises
        };

        await finishSession(session.sessionId, metrics);
        localStorage.removeItem(SESSION_KEY);

        setDiaryComment('');
        setSummaryData({
            duration,
            volume,
            totalSets: completedSets.length,
            totalExercises: uniqueExercises,
            prevVolume: prevSession?.session.total_volume ?? null,
            completedSets,
            dayLabel: session.day.day_label,
            dayName: session.day.day_name
        });

        setScreen('summary');
    };

    // ─── Back to Selection ────────────────────────────
    const backToSelection = async () => {
        // Save to Diário de Treino (with comment from summary screen)
        if (studentId && academyId && summaryData) {
            const fmtTime = (s: number) => `${Math.floor(s / 60)}min ${s % 60}s`;
            const diaryTitle = `Treino ${summaryData.dayLabel} - ${summaryData.dayName} (${fmtTime(summaryData.duration)})`;

            const commentNote = diaryComment.trim() ? `\n📝 ${diaryComment.trim()}` : '';

            const diaryPayload: CreateDiaryData = {
                academy_id: academyId,
                student_id: studentId,
                title: diaryTitle,
                exercises: summaryData.completedSets.map(s => ({
                    exercise_name: s.exerciseName,
                    sets: s.setNumber,
                    repetitions: s.reps,
                    weight: s.load,
                    set_number: s.setNumber,
                    rest_seconds: s.restUsed,
                    notes: s.setNumber === 1 ? commentNote.trim() || undefined : undefined
                }))
            };

            await createWorkoutDiary(diaryPayload);
        }

        setScreen('selection');
        setSession(null);
        setSummaryData(null);
        setPrevSession(null);
        setElapsed(0);
        setDiaryComment('');
        if (studentId) {
            const hist = await getSessionHistory(studentId, 10);
            if (hist.success && hist.data) setHistory(hist.data);
        }
    };
    // ─── Mobile CSS injection (workout-specific rules) ─
    useEffect(() => {
        const styleId = 'pk-iniciar-treino-mobile';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            @media (max-width: 768px) {
                .pk-workout-container {
                    width: 100% !important;
                    max-width: 100% !important;
                    padding: 0 !important;
                }
                .pk-input-grid {
                    grid-template-columns: 1fr !important;
                }
                .pk-desktop-only {
                    display: none !important;
                }
                .pk-mobile-only {
                    display: block !important;
                }
                .pk-history-row {
                    flex-direction: column !important;
                    align-items: flex-start !important;
                    gap: 4px !important;
                }
                .pk-history-meta {
                    flex-wrap: wrap !important;
                    gap: 6px !important;
                    font-size: 11px !important;
                }
                .pk-exercise-pills {
                    max-height: 56px;
                    overflow: hidden;
                }
            }
        `;
        document.head.appendChild(style);
        return () => { document.getElementById(styleId)?.remove(); };
    }, []);

    // ─── Styles ───────────────────────────────────────
    const card: React.CSSProperties = { background: 'var(--background-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: 'var(--spacing-4)', overflow: 'hidden' };
    const bigNum: React.CSSProperties = { fontSize: '64px', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' };
    const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '100px', fontSize: 'var(--font-size-xs)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' };

    // ═════════════════════════════════════════════════
    // RENDER
    // ═════════════════════════════════════════════════

    // ─── SCREEN: COUNTDOWN ────────────────────────────
    if (screen === 'countdown') {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: '#0f0f1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', zIndex: 9999, color: '#fff'
            }}>
                <div style={{
                    fontSize: countdownNum > 0 ? '160px' : '56px',
                    fontWeight: 900,
                    color: countdownNum > 0 ? '#818cf8' : '#34d399',
                    textShadow: '0 0 60px rgba(129,140,248,0.4)',
                    animation: 'pulse 0.5s ease-in-out',
                    transition: 'all 0.3s'
                }}>
                    {countdownNum > 0 ? countdownNum : '🔥 BORA!'}
                </div>
                <p style={{ color: '#94a3b8', marginTop: '24px', fontSize: '18px' }}>Preparar...</p>
            </div>
        );
    }

    // ─── SCREEN: REST TIMER ───────────────────────────
    if (screen === 'rest') {
        const pct = session && currentExercise
            ? Math.max(0, Math.min(100, (restRemaining / (currentExercise.rest || 60)) * 100))
            : 0;
        const isLow = restRemaining <= 5;

        return (
            <div style={{
                position: 'fixed', inset: 0, background: '#0f0f1a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', zIndex: 9999, color: '#fff', padding: '24px'
            }}>
                <p style={{ color: '#94a3b8', fontSize: '16px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '2px' }}>
                    Descanso
                </p>

                {/* Circular indicator */}
                <div style={{ position: 'relative', width: 220, height: 220, marginBottom: '24px' }}>
                    <svg width="220" height="220" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="110" cy="110" r="100" fill="none" stroke="#1e293b" strokeWidth="8" />
                        <circle cx="110" cy="110" r="100" fill="none"
                            stroke={isLow ? '#ef4444' : '#818cf8'}
                            strokeWidth="8" strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 100}`}
                            strokeDashoffset={`${2 * Math.PI * 100 * (1 - pct / 100)}`}
                            style={{ transition: 'stroke-dashoffset 0.3s, stroke 0.3s' }}
                        />
                    </svg>
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column'
                    }}>
                        <div style={{
                            ...bigNum,
                            fontSize: '56px',
                            color: isLow ? '#ef4444' : '#fff'
                        }}>
                            {fmtDuration(restRemaining)}
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <button onClick={() => adjustRest(-15)} style={{
                        background: '#1e293b', border: 'none', color: '#ef4444',
                        padding: '10px 20px', borderRadius: '12px', cursor: 'pointer',
                        fontSize: '16px', fontWeight: 700
                    }}>-15s</button>
                    <button onClick={() => adjustRest(15)} style={{
                        background: '#1e293b', border: 'none', color: '#34d399',
                        padding: '10px 20px', borderRadius: '12px', cursor: 'pointer',
                        fontSize: '16px', fontWeight: 700
                    }}>+15s</button>
                </div>
                <button onClick={skipRest} style={{
                    background: '#818cf8', border: 'none', color: '#fff',
                    padding: '14px 40px', borderRadius: '12px', cursor: 'pointer',
                    fontSize: '16px', fontWeight: 700
                }}>
                    ⏩ Pular Descanso
                </button>

                {/* Next exercise info */}
                {session && (
                    <p style={{ color: '#64748b', marginTop: '24px', fontSize: '14px' }}>
                        Próximo: {session.day.exercises[session.exerciseIndex]?.name} — Série {session.setIndex + 1}/{session.day.exercises[session.exerciseIndex]?.sets}
                    </p>
                )}
            </div>
        );
    }

    // ─── SCREEN: SUMMARY ──────────────────────────────
    if (screen === 'summary' && summaryData) {
        const volumeChange = summaryData.prevVolume != null
            ? ((summaryData.volume - summaryData.prevVolume) / Math.max(summaryData.prevVolume, 1)) * 100
            : null;

        return (
            <AlunoLayout title="Treino Finalizado" menuItems={menuItems}>
                <div className="pk-workout-container" style={{ maxWidth: 500, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
                    {/* Hero */}
                    <div style={{
                        textAlign: 'center', padding: 'var(--spacing-6)',
                        background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                        borderRadius: 'var(--radius-lg)', color: '#fff', marginBottom: 'var(--spacing-4)'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '8px' }}>🏆</div>
                        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Treino Concluído!</h2>
                        <p style={{ opacity: 0.8 }}>Parabéns, você finalizou seu treino!</p>
                    </div>

                    {/* Metrics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
                        <div style={{ ...card, textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>⏱️ Tempo Total</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary-600)' }}>{fmtDuration(summaryData.duration)}</div>
                        </div>
                        <div style={{ ...card, textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>🏋️ Volume Total</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>
                                {summaryData.volume.toLocaleString('pt-BR')} kg
                            </div>
                        </div>
                        <div style={{ ...card, textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>📊 Séries</div>
                            <div style={{ fontSize: '24px', fontWeight: 800 }}>{summaryData.totalSets}</div>
                        </div>
                        <div style={{ ...card, textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>💪 Exercícios</div>
                            <div style={{ fontSize: '24px', fontWeight: 800 }}>{summaryData.totalExercises}</div>
                        </div>
                    </div>

                    {/* Comparison */}
                    {volumeChange != null && (
                        <div style={{
                            ...card, marginBottom: 'var(--spacing-4)',
                            borderLeft: `4px solid ${volumeChange >= 0 ? '#34d399' : '#ef4444'}`
                        }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                                Comparação com Último Treino
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                    ...pill,
                                    background: volumeChange >= 0 ? '#dcfce7' : '#fee2e2',
                                    color: volumeChange >= 0 ? '#16a34a' : '#dc2626'
                                }}>
                                    {volumeChange >= 0 ? '↑' : '↓'} {Math.abs(volumeChange).toFixed(1)}%
                                </span>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    Volume anterior: {summaryData.prevVolume?.toLocaleString('pt-BR')} kg
                                </span>
                            </div>
                            {volumeChange > 0 && (
                                <div style={{ marginTop: '8px', fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                                    🎉 Novo recorde pessoal!
                                </div>
                            )}
                        </div>
                    )}

                    {/* Comment for diary */}
                    <div style={{ ...card, marginBottom: 'var(--spacing-4)' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                            💬 Comentário do Treino (opcional)
                        </label>
                        <textarea
                            value={diaryComment}
                            onChange={e => setDiaryComment(e.target.value)}
                            placeholder="Ex: Hoje consegui aumentar a carga no supino!"
                            rows={3}
                            style={{
                                width: '100%', padding: 'var(--spacing-2) var(--spacing-3)',
                                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
                                fontSize: 'var(--font-size-sm)', fontFamily: 'inherit', resize: 'vertical',
                                background: 'var(--background-secondary)', boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <button onClick={backToSelection} className="btn-submit" style={{
                        width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700
                    }}>
                        ✅ Finalizar e Voltar
                    </button>
                </div>
            </AlunoLayout>
        );
    }

    // ─── SCREEN: EXECUTION ────────────────────────────
    if (screen === 'execution' && session && currentExercise) {
        const progress = session.day.exercises.length > 0
            ? Math.round((session.exerciseIndex / session.day.exercises.length) * 100)
            : 0;

        return (
            <AlunoLayout title="Treino em Andamento" menuItems={menuItems}>
                <div className="pk-workout-container" style={{ maxWidth: 500, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
                    {/* Header bar */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 'var(--spacing-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)',
                        gap: '8px', flexWrap: 'wrap'
                    }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>🏋️ {session.day.day_label} — {session.day.day_name}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--primary-600)', flexShrink: 0 }}>
                            ⏱️ {fmtDuration(elapsed)}
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div style={{
                        height: '6px', background: 'var(--background-secondary)',
                        borderRadius: '3px', marginBottom: 'var(--spacing-4)', overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%', width: `${progress}%`,
                            background: 'linear-gradient(90deg, #818cf8, #6366f1)',
                            borderRadius: '3px', transition: 'width 0.3s'
                        }} />
                    </div>

                    {/* Exercise card */}
                    <div style={{
                        ...card,
                        borderLeft: '4px solid var(--primary-500)',
                        marginBottom: 'var(--spacing-4)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-3)', gap: '8px' }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px' }}>
                                    Exercício {session.exerciseIndex + 1}/{session.day.exercises.length}
                                </div>
                                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, margin: 0, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                    {currentExercise.name}
                                </h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                <div style={{
                                    ...pill,
                                    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                                    color: '#fff'
                                }}>
                                    Série {currentSetDisplay}/{totalSetsForCurrentExercise}
                                </div>
                                <button
                                    onClick={() => setIsReordering(true)}
                                    style={{
                                        background: 'transparent', border: '1px solid var(--border-color)',
                                        color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px',
                                        fontSize: '11px', cursor: 'pointer', fontWeight: 600
                                    }}>
                                    Alterar Ordem
                                </button>
                            </div>
                        </div>

                        {/* Suggested info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)', minWidth: 0 }}>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Reps</div>
                                <div style={{ fontWeight: 700, fontSize: '16px' }}>{currentExercise.reps}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Carga</div>
                                <div style={{ fontWeight: 700, fontSize: '16px', color: '#f59e0b' }}>{currentExercise.load || '—'}</div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '8px', background: 'var(--background-secondary)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Descanso</div>
                                <div style={{ fontWeight: 700, fontSize: '16px' }}>{currentExercise.rest}s</div>
                            </div>
                        </div>

                        {currentExercise.notes && (
                            <div style={{
                                padding: '8px 12px', background: 'var(--background-secondary)',
                                borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--text-secondary)',
                                fontStyle: 'italic', marginBottom: 'var(--spacing-3)'
                            }}>
                                💬 {currentExercise.notes}
                            </div>
                        )}
                    </div>

                    {/* Input card */}
                    <div style={{ ...card, marginBottom: 'var(--spacing-4)' }}>
                        <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 'var(--spacing-3)' }}>
                            Registrar Série
                        </h4>
                        {/* Mobile-only load input (above reps) */}
                        <div className="pk-mobile-only" style={{ display: 'none', marginBottom: 'var(--spacing-3)' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Carga (kg)
                            </label>
                            <input
                                type="number" inputMode="decimal" min="0" step="0.5" placeholder="0"
                                value={loadInput} onChange={e => setLoadInput(e.target.value)}
                                style={{
                                    width: '100%', height: 48, padding: '10px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    border: '2px solid var(--border-color)', fontSize: '20px',
                                    fontWeight: 800, textAlign: 'center', fontFamily: 'inherit',
                                    color: '#f59e0b', boxSizing: 'border-box',
                                    background: 'var(--background-primary)'
                                }}
                            />
                        </div>

                        <div className="pk-input-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)', alignItems: 'end' }}>
                            {/* Reps with +/- */}
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Repetições
                                </label>
                                <div style={{
                                    display: 'flex', alignItems: 'center',
                                    border: '2px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                                    overflow: 'hidden', background: 'var(--background-primary)',
                                    height: 48
                                }}>
                                    <button
                                        onClick={() => setRepsInput(prev => String(Math.max(0, (parseInt(prev) || 0) - 1)))}
                                        style={{
                                            width: 36, height: '100%', border: 'none',
                                            background: 'var(--background-secondary)',
                                            fontSize: '20px', fontWeight: 800, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)',
                                            flexShrink: 0
                                        }}
                                    >−</button>
                                    <input
                                        type="number" min="0" placeholder="0"
                                        value={repsInput} onChange={e => setRepsInput(e.target.value)}
                                        style={{
                                            flex: 1, minWidth: 0, padding: '8px 4px', border: 'none',
                                            fontSize: '20px', fontWeight: 800, textAlign: 'center',
                                            fontFamily: 'inherit', outline: 'none',
                                            background: 'transparent'
                                        }}
                                    />
                                    <button
                                        onClick={() => setRepsInput(prev => String((parseInt(prev) || 0) + 1))}
                                        style={{
                                            width: 36, height: '100%', border: 'none',
                                            background: 'var(--primary-50, #eef2ff)',
                                            fontSize: '20px', fontWeight: 800, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'var(--primary-600)', borderLeft: '1px solid var(--border-color)',
                                            flexShrink: 0
                                        }}
                                    >+</button>
                                </div>
                            </div>
                            {/* Load - simple input (desktop only) */}
                            <div className="pk-desktop-only">
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Carga (kg)
                                </label>
                                <input
                                    type="number" min="0" step="0.5" placeholder="0"
                                    value={loadInput} onChange={e => setLoadInput(e.target.value)}
                                    style={{
                                        width: '100%', height: 52, padding: '10px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '2px solid var(--border-color)', fontSize: '20px',
                                        fontWeight: 800, textAlign: 'center', fontFamily: 'inherit',
                                        color: '#f59e0b', boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={handleFinishSet}
                                disabled={isSaving}
                                style={{
                                    width: '100%', padding: '14px',
                                    background: 'linear-gradient(135deg, #34d399, #10b981)',
                                    color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                                    fontSize: '16px', fontWeight: 800, cursor: 'pointer',
                                    opacity: isSaving ? 0.7 : 1
                                }}
                            >
                                {isSaving ? 'Salvando...' : 'Finalizar Série'}
                            </button>

                            <button
                                onClick={() => setShowFinishConfirm(true)}
                                disabled={isSaving}
                                style={{
                                    width: '100%', padding: '14px',
                                    background: 'transparent',
                                    color: '#ef4444', border: '2px solid #ef4444', borderRadius: 'var(--radius-md)',
                                    fontSize: '16px', fontWeight: 700, cursor: 'pointer',
                                    opacity: isSaving ? 0.7 : 1
                                }}
                            >
                                Encerrar Treino Antecipadamente
                            </button>
                        </div>
                    </div>

                    {/* Reorder Modal */}
                    {isReordering && (
                        <div style={{
                            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10000, padding: '24px'
                        }}>
                            <div style={{
                                background: '#1e293b', width: '100%', maxWidth: 400,
                                borderRadius: '16px', border: '1px solid #334155',
                                padding: '20px', maxHeight: '90vh', overflowY: 'auto',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>Alterar Ordem</h3>
                                    <button onClick={() => setIsReordering(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
                                </div>

                                <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '16px' }}>
                                    Selecione o exercício que deseja fazer agora:
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {session.day.exercises.slice(session.setIndex === 0 ? session.exerciseIndex : session.exerciseIndex + 1).map((ex, idx) => {
                                        const originalIndex = (session.setIndex === 0 ? session.exerciseIndex : session.exerciseIndex + 1) + idx;
                                        return (
                                            <div key={ex.id || idx} style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '12px', background: '#0f172a',
                                                borderRadius: '8px', border: '1px solid #334155'
                                            }}>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>{ex.name}</div>
                                                <button
                                                    onClick={() => {
                                                        const newExercises = [...session.day.exercises];
                                                        const targetEx = newExercises.splice(originalIndex, 1)[0];
                                                        const insertIndex = session.setIndex === 0 ? session.exerciseIndex : session.exerciseIndex + 1;
                                                        newExercises.splice(insertIndex, 0, targetEx);

                                                        setSession({
                                                            ...session,
                                                            day: {
                                                                ...session.day,
                                                                exercises: newExercises
                                                            }
                                                        });

                                                        if (session.setIndex === 0) {
                                                            setRepsInput(String(parseMinReps(targetEx.reps)));
                                                            setLoadInput(targetEx.load || '');
                                                        }

                                                        setIsReordering(false);
                                                    }}
                                                    style={{
                                                        background: '#3b82f6', color: '#ffffff', border: 'none',
                                                        padding: '6px 12px', borderRadius: '4px', fontSize: '12px',
                                                        fontWeight: 700, cursor: 'pointer'
                                                    }}>
                                                    Fazer Agora
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Finish Confirm Modal */}
                    {showFinishConfirm && (
                        <div style={{
                            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 10000, padding: '24px'
                        }}>
                            <div style={{
                                background: '#1e293b', width: '100%', maxWidth: 400,
                                borderRadius: '16px', border: '1px solid #334155',
                                padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                            }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#ef4444' }}>
                                    Encerrar Treino
                                </h3>
                                <p style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '24px', lineHeight: 1.5 }}>
                                    Tem certeza que deseja encerrar o treino antes de completá-lo? Apenas as séries salvas até aqui serão registradas.
                                </p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setShowFinishConfirm(false)}
                                        style={{
                                            flex: 1, padding: '12px', background: 'transparent', border: '1px solid #cbd5e1',
                                            color: '#f8fafc', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer'
                                        }}>
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowFinishConfirm(false);
                                            finishWorkout(session.setsCompleted);
                                        }}
                                        style={{
                                            flex: 1, padding: '12px', background: '#ef4444', border: 'none',
                                            color: '#ffffff', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer'
                                        }}>
                                        Sim, Encerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </AlunoLayout>
        );
    }

    // ─── SCREEN: SELECTION (default) ──────────────────
    return (
        <AlunoLayout title="Iniciar Treino" menuItems={menuItems}>
            <div className="pk-workout-container" style={{ maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
                {/* Header */}
                <div style={{ marginBottom: 'var(--spacing-5)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '4px' }}>
                        🚀 Iniciar Treino
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Selecione o treino do dia para começar
                    </p>
                </div>

                {message && (
                    <div className={`message-toast ${message.type}`} style={{ marginBottom: 'var(--spacing-4)' }}>
                        {message.text}
                    </div>
                )}

                {isLoading ? (
                    <div className="loading-state"><div className="spinner"></div><p>Carregando...</p></div>
                ) : !workout || workout.days.length === 0 ? (
                    <div className="empty-state" style={{ padding: 'var(--spacing-8)', textAlign: 'center' }}>
                        <div style={{ fontSize: '48px', marginBottom: 'var(--spacing-3)' }}>📋</div>
                        <h3>Nenhum treino disponível</h3>
                        <p>Peça ao seu professor para criar sua ficha de treino.</p>
                    </div>
                ) : (
                    <>
                        {/* Workout days */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-6)' }}>
                            {workout.days.map(day => {
                                // Find last session for this day
                                const lastHist = history.find(h => h.workout_day_id === day.id);

                                return (
                                    <div
                                        key={day.id}
                                        onClick={() => handleSelectDay(day)}
                                        style={{
                                            ...card, cursor: 'pointer',
                                            transition: 'border-color 0.15s, box-shadow 0.15s',
                                            borderLeft: '4px solid var(--primary-400)'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-300)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.borderLeftColor = 'var(--primary-400)'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                                                <div style={{
                                                    width: 40, height: 40, borderRadius: 'var(--radius-md)',
                                                    background: 'linear-gradient(135deg, #818cf8, #6366f1)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontWeight: 800, fontSize: '16px'
                                                }}>
                                                    {day.day_label}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                                                        Treino {day.day_label}
                                                    </div>
                                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                        {day.day_name}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pk-selection-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                        {day.exercises.length} exercícios
                                                    </div>
                                                    {lastHist && (
                                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                            Último: {new Date(lastHist.started_at).toLocaleDateString('pt-BR')}
                                                        </div>
                                                    )}
                                                </div>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--primary-500)">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Exercise preview */}
                                        <div className="pk-exercise-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {day.exercises.slice(0, 5).map((ex, i) => (
                                                <span key={i} style={{
                                                    ...pill,
                                                    background: 'var(--background-secondary)',
                                                    color: 'var(--text-secondary)'
                                                }}>
                                                    {ex.name}
                                                </span>
                                            ))}
                                            {day.exercises.length > 5 && (
                                                <span style={{ ...pill, background: 'var(--background-secondary)', color: 'var(--text-secondary)' }}>
                                                    +{day.exercises.length - 5}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* History */}
                        {history.length > 0 && (
                            <div>
                                <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, marginBottom: 'var(--spacing-3)', color: 'var(--text-secondary)' }}>
                                    📊 Últimas Sessões
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                                    {history.slice(0, 5).map(h => (
                                        <div key={h.id} className="pk-history-row" style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: 'var(--spacing-2) var(--spacing-3)',
                                            background: 'var(--background-secondary)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-xs)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 700, color: 'var(--primary-600)' }}>
                                                    Treino {h.day_label || '?'}
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                    {h.day_name || ''}
                                                </span>
                                            </div>
                                            <div className="pk-history-meta" style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                                                <span>⏱ {fmtDuration(h.total_duration_seconds)}</span>
                                                <span>🏋️ {h.total_volume?.toLocaleString('pt-BR')} kg</span>
                                                <span>{new Date(h.started_at).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AlunoLayout>
    );
}
