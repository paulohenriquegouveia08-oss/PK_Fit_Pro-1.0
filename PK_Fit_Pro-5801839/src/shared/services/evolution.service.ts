import { supabase } from './supabase';

// ============ Types ============

export interface LoadEvolutionPoint {
    date: string;
    exercise_name: string;
    max_load: number;
    total_volume: number;
    total_sets: number;
}

export interface RepsEvolutionPoint {
    date: string;
    best_reps: number;
    load_at_best: number;
    avg_reps: number;
    avg_load: number;
}

export interface FrequencyDay {
    date: string;
    trained: boolean;
    session_count: number;
}

export interface AnalysisInsight {
    type: 'positive' | 'negative' | 'neutral';
    icon: string;
    text: string;
}

export interface StreakInfo {
    currentStreak: number;
    bestStreak: number;
}

export interface PerformanceComparison {
    volumeEvolution: number; // %
    loadEvolution: number; // %
    freqEvolution: number; // %
}

// ============ Constants ============

export const MUSCLE_GROUPS = [
    'Peito', 'Costas', 'Pernas', 'Ombro',
    'Bíceps', 'Tríceps', 'Abdômen', 'Outros'
] as const;

export const PERIOD_OPTIONS = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '90 dias', value: 90 },
    { label: '6 meses', value: 180 },
    { label: '1 ano', value: 365 },
] as const;

// ============ Functions ============

/**
 * Get load evolution data — aggregated per day per exercise
 * Falls back to client-side query if RPC is not available
 */
export async function getLoadEvolution(
    studentId: string,
    days: number,
    exerciseFilter?: string
): Promise<LoadEvolutionPoint[]> {
    try {
        // Try RPC first
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_evolucao_carga', {
            p_student_id: studentId,
            p_days: days,
            p_exercise_filter: exerciseFilter || null
        });

        if (!rpcError && rpcData) {
            return rpcData as LoadEvolutionPoint[];
        }

        // Fallback: client-side query
        return await getLoadEvolutionFallback(studentId, days, exerciseFilter);
    } catch {
        return await getLoadEvolutionFallback(studentId, days, exerciseFilter);
    }
}

async function getLoadEvolutionFallback(
    studentId: string,
    days: number,
    exerciseFilter?: string
): Promise<LoadEvolutionPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get completed sessions in the period
    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .eq('student_id', studentId)
        .eq('status', 'concluido')
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: true });

    if (!sessions || sessions.length === 0) return [];

    const sessionIds = sessions.map(s => s.id);

    // Get set logs for those sessions
    let query = supabase
        .from('workout_set_logs')
        .select('session_id, exercise_name, load_done, reps_done, set_number, completed_at')
        .in('session_id', sessionIds);

    if (exerciseFilter) {
        query = query.eq('exercise_name', exerciseFilter);
    }

    const { data: sets } = await query;
    if (!sets || sets.length === 0) return [];

    // Build a session date map
    const sessionDateMap = new Map<string, string>();
    for (const s of sessions) {
        sessionDateMap.set(s.id, s.started_at.split('T')[0]);
    }

    // Aggregate by date + exercise
    const agg = new Map<string, {
        date: string;
        exercise_name: string;
        max_load: number;
        total_volume: number;
        total_sets: number;
    }>();

    for (const set of sets) {
        const date = sessionDateMap.get(set.session_id) || '';
        const key = `${date}|${set.exercise_name}`;
        if (!agg.has(key)) {
            agg.set(key, {
                date,
                exercise_name: set.exercise_name,
                max_load: 0,
                total_volume: 0,
                total_sets: 0
            });
        }
        const entry = agg.get(key)!;
        entry.max_load = Math.max(entry.max_load, set.load_done || 0);
        entry.total_volume += (set.load_done || 0) * (set.reps_done || 0);
        entry.total_sets += 1;
    }

    return Array.from(agg.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get reps evolution for a specific exercise
 */
export async function getRepsEvolution(
    studentId: string,
    exerciseName: string,
    days: number
): Promise<RepsEvolutionPoint[]> {
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_evolucao_reps', {
            p_student_id: studentId,
            p_exercise_name: exerciseName,
            p_days: days
        });

        if (!rpcError && rpcData) {
            return rpcData as RepsEvolutionPoint[];
        }

        return await getRepsEvolutionFallback(studentId, exerciseName, days);
    } catch {
        return await getRepsEvolutionFallback(studentId, exerciseName, days);
    }
}

async function getRepsEvolutionFallback(
    studentId: string,
    exerciseName: string,
    days: number
): Promise<RepsEvolutionPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, started_at')
        .eq('student_id', studentId)
        .eq('status', 'concluido')
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: true });

    if (!sessions || sessions.length === 0) return [];

    const sessionIds = sessions.map(s => s.id);

    const { data: sets } = await supabase
        .from('workout_set_logs')
        .select('session_id, reps_done, load_done')
        .in('session_id', sessionIds)
        .eq('exercise_name', exerciseName);

    if (!sets || sets.length === 0) return [];

    const sessionDateMap = new Map<string, string>();
    for (const s of sessions) {
        sessionDateMap.set(s.id, s.started_at.split('T')[0]);
    }

    // Aggregate by date — best reps and avg
    const agg = new Map<string, { reps: number[]; loads: number[]; bestReps: number; loadAtBest: number }>();

    for (const set of sets) {
        const date = sessionDateMap.get(set.session_id) || '';
        if (!agg.has(date)) {
            agg.set(date, { reps: [], loads: [], bestReps: 0, loadAtBest: 0 });
        }
        const entry = agg.get(date)!;
        entry.reps.push(set.reps_done || 0);
        entry.loads.push(set.load_done || 0);
        if ((set.reps_done || 0) > entry.bestReps) {
            entry.bestReps = set.reps_done || 0;
            entry.loadAtBest = set.load_done || 0;
        }
    }

    return Array.from(agg.entries())
        .map(([date, d]) => ({
            date,
            best_reps: d.bestReps,
            load_at_best: d.loadAtBest,
            avg_reps: Math.round(d.reps.reduce((a, b) => a + b, 0) / d.reps.length),
            avg_load: Math.round(d.loads.reduce((a, b) => a + b, 0) / d.loads.length)
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get training frequency data
 */
export async function getTrainingFrequency(
    studentId: string,
    days: number
): Promise<FrequencyDay[]> {
    try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('rpc_frequencia_treino', {
            p_student_id: studentId,
            p_days: days
        });

        if (!rpcError && rpcData) {
            return rpcData as FrequencyDay[];
        }

        return await getTrainingFrequencyFallback(studentId, days);
    } catch {
        return await getTrainingFrequencyFallback(studentId, days);
    }
}

async function getTrainingFrequencyFallback(
    studentId: string,
    days: number
): Promise<FrequencyDay[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('started_at')
        .eq('student_id', studentId)
        .eq('status', 'concluido')
        .gte('started_at', since.toISOString());

    const trainedDates = new Set<string>();
    for (const s of sessions || []) {
        trainedDates.add(s.started_at.split('T')[0]);
    }

    const result: FrequencyDay[] = [];
    const cursor = new Date(since);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    while (cursor <= today) {
        const dateStr = cursor.toISOString().split('T')[0];
        result.push({
            date: dateStr,
            trained: trainedDates.has(dateStr),
            session_count: trainedDates.has(dateStr) ? 1 : 0
        });
        cursor.setDate(cursor.getDate() + 1);
    }

    return result;
}

/**
 * Get list of distinct exercise names from the student's history
 */
export async function getStudentExercises(studentId: string): Promise<string[]> {
    const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id')
        .eq('student_id', studentId)
        .eq('status', 'concluido')
        .order('started_at', { ascending: false })
        .limit(50);

    if (!sessions || sessions.length === 0) return [];

    const { data: sets } = await supabase
        .from('workout_set_logs')
        .select('exercise_name')
        .in('session_id', sessions.map(s => s.id));

    if (!sets) return [];

    const unique = [...new Set(sets.map(s => s.exercise_name))];
    return unique.sort();
}

/**
 * Generate automatic analysis insights by comparing periods
 */
export function generateInsights(
    loadData: LoadEvolutionPoint[],
    frequencyData: FrequencyDay[],
    days: number
): AnalysisInsight[] {
    const insights: AnalysisInsight[] = [];

    // --- Load analysis ---
    if (loadData.length >= 2) {
        const mid = Math.floor(loadData.length / 2);
        const firstHalf = loadData.slice(0, mid);
        const secondHalf = loadData.slice(mid);

        const avgFirst = firstHalf.reduce((s, p) => s + p.total_volume, 0) / (firstHalf.length || 1);
        const avgSecond = secondHalf.reduce((s, p) => s + p.total_volume, 0) / (secondHalf.length || 1);

        if (avgFirst > 0) {
            const pctChange = ((avgSecond - avgFirst) / avgFirst) * 100;
            if (pctChange > 5) {
                insights.push({
                    type: 'positive',
                    icon: '📈',
                    text: `Seu volume de treino aumentou ${Math.round(pctChange)}% nos últimos ${days} dias. Continue assim!`
                });
            } else if (pctChange < -5) {
                insights.push({
                    type: 'negative',
                    icon: '📉',
                    text: `Seu volume de treino caiu ${Math.abs(Math.round(pctChange))}% recentemente. Tente manter a consistência.`
                });
            } else {
                insights.push({
                    type: 'neutral',
                    icon: '➡️',
                    text: `Seu volume de treino está estável nos últimos ${days} dias.`
                });
            }
        }

        // Max load analysis
        const maxLoadFirst = Math.max(...firstHalf.map(p => p.max_load), 0);
        const maxLoadSecond = Math.max(...secondHalf.map(p => p.max_load), 0);
        if (maxLoadSecond > maxLoadFirst && maxLoadFirst > 0) {
            const pct = ((maxLoadSecond - maxLoadFirst) / maxLoadFirst) * 100;
            insights.push({
                type: 'positive',
                icon: '💪',
                text: `Sua carga máxima aumentou ${Math.round(pct)}% — você está ficando mais forte!`
            });
        }
    }

    // --- Frequency analysis ---
    if (frequencyData.length > 0) {
        const totalDays = frequencyData.length;
        const trainedDays = frequencyData.filter(d => d.trained).length;
        const pct = Math.round((trainedDays / totalDays) * 100);

        if (pct >= 70) {
            insights.push({
                type: 'positive',
                icon: '🔥',
                text: `Excelente consistência! Você treinou ${trainedDays} de ${totalDays} dias (${pct}%).`
            });
        } else if (pct >= 40) {
            insights.push({
                type: 'neutral',
                icon: '📊',
                text: `Você treinou ${trainedDays} de ${totalDays} dias (${pct}%). Tente aumentar a frequência!`
            });
        } else {
            insights.push({
                type: 'negative',
                icon: '⚠️',
                text: `Frequência baixa: ${trainedDays} de ${totalDays} dias (${pct}%). Regularidade é chave para resultados!`
            });
        }

        // Weekly streak check
        const last7 = frequencyData.slice(-7);
        const last7Trained = last7.filter(d => d.trained).length;
        if (last7Trained >= 5) {
            insights.push({
                type: 'positive',
                icon: '🏆',
                text: `Semana incrível! Você treinou ${last7Trained} dos últimos 7 dias.`
            });
        } else if (last7Trained <= 1) {
            insights.push({
                type: 'negative',
                icon: '😴',
                text: `Sua frequência caiu esta semana. Apenas ${last7Trained} treino nos últimos 7 dias.`
            });
        }
    }

    return insights;
}

/**
 * Calculate Current and Best Streaks
 */
export function getStreaks(frequencyData: FrequencyDay[]): StreakInfo {
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;

    // Iterate backwards from yesterday/today
    for (let i = frequencyData.length - 1; i >= 0; i--) {
        if (frequencyData[i].trained) {
            tempStreak++;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
            // Se hoje não treinou ainda, permite manter a streak de ontem.
            if (i === frequencyData.length - 1) {
                // do nothing, skip today
            } else {
                tempStreak = 0;
            }
        }
    }

    // Now recalculate current streak properly starting from end
    for (let i = frequencyData.length - 1; i >= 0; i--) {
        if (frequencyData[i].trained) {
            currentStreak++;
        } else if (i === frequencyData.length - 1) {
            // Ignore if skipped today only
        } else {
            break;
        }
    }

    // Pass one more time for absolute best streak from start to finish
    tempStreak = 0;
    for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i].trained) {
            tempStreak++;
            if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
            tempStreak = 0;
        }
    }

    return { currentStreak, bestStreak };
}

/**
 * Compare two halves of the period to yield % evolution
 */
export function getPerformanceComparison(
    loadData: LoadEvolutionPoint[],
    frequencyData: FrequencyDay[]
): PerformanceComparison {
    let volumeEvolution = 0;
    let loadEvolution = 0;
    let freqEvolution = 0;

    if (loadData.length >= 2) {
        const mid = Math.floor(loadData.length / 2);
        const firstHalf = loadData.slice(0, mid);
        const secondHalf = loadData.slice(mid);

        const v1 = firstHalf.reduce((s, p) => s + p.total_volume, 0) / (firstHalf.length || 1);
        const v2 = secondHalf.reduce((s, p) => s + p.total_volume, 0) / (secondHalf.length || 1);
        if (v1 > 0) volumeEvolution = Math.round(((v2 - v1) / v1) * 100);

        const l1 = Math.max(...firstHalf.map(p => p.max_load), 0);
        const l2 = Math.max(...secondHalf.map(p => p.max_load), 0);
        if (l1 > 0) loadEvolution = Math.round(((l2 - l1) / l1) * 100);
    }

    if (frequencyData.length >= 2) {
        const mid = Math.floor(frequencyData.length / 2);
        const firstHalf = frequencyData.slice(0, mid);
        const secondHalf = frequencyData.slice(mid);

        const f1 = firstHalf.filter(d => d.trained).length;
        const f2 = secondHalf.filter(d => d.trained).length;
        
        // Se ambos forem zero, a evolução é 0. Se f1 for 0, mas f2 for >0, consideramos +100%
        if (f1 > 0) {
            freqEvolution = Math.round(((f2 - f1) / f1) * 100);
        } else if (f2 > 0) {
            freqEvolution = 100;
        }
    }

    return { volumeEvolution, loadEvolution, freqEvolution };
}
