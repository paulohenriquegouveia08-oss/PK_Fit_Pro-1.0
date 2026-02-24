import { supabase } from './supabase';
import type { ApiResponse } from '../types';

// ============ Types ============

export interface WorkoutSession {
    id: string;
    student_id: string;
    workout_id: string;
    workout_day_id: string;
    status: 'em_andamento' | 'concluido' | 'pausado';
    started_at: string;
    finished_at: string | null;
    total_duration_seconds: number;
    total_volume: number;
    total_sets: number;
    total_exercises: number;
    created_at: string;
    // Enriched fields
    day_label?: string;
    day_name?: string;
}

export interface SetLog {
    id: string;
    session_id: string;
    exercise_id: string;
    exercise_name: string;
    set_number: number;
    reps_target: string | null;
    reps_done: number;
    load_target: string | null;
    load_done: number;
    rest_seconds_target: number;
    rest_seconds_used: number;
    completed_at: string;
}

export interface LogSetData {
    session_id: string;
    exercise_id: string;
    exercise_name: string;
    set_number: number;
    reps_target: string | null;
    reps_done: number;
    load_target: string | null;
    load_done: number;
    rest_seconds_target: number;
    rest_seconds_used: number;
}

export interface SessionMetrics {
    total_duration_seconds: number;
    total_volume: number;
    total_sets: number;
    total_exercises: number;
}

// ============ Functions ============

/**
 * Start a new workout session
 */
export async function startSession(
    studentId: string,
    workoutId: string,
    dayId: string
): Promise<ApiResponse<WorkoutSession>> {
    try {
        // Cancel any existing active sessions for this student
        await supabase
            .from('workout_sessions')
            .update({ status: 'pausado' })
            .eq('student_id', studentId)
            .eq('status', 'em_andamento');

        const { data, error } = await supabase
            .from('workout_sessions')
            .insert({
                student_id: studentId,
                workout_id: workoutId,
                workout_day_id: dayId,
                status: 'em_andamento',
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: data as WorkoutSession };
    } catch (error) {
        console.error('Error starting session:', error);
        return { success: false, error: 'Erro ao iniciar sessão' };
    }
}

/**
 * Log a completed set
 */
export async function logSet(data: LogSetData): Promise<ApiResponse<SetLog>> {
    try {
        const { data: log, error } = await supabase
            .from('workout_set_logs')
            .insert({
                session_id: data.session_id,
                exercise_id: data.exercise_id,
                exercise_name: data.exercise_name,
                set_number: data.set_number,
                reps_target: data.reps_target,
                reps_done: data.reps_done,
                load_target: data.load_target,
                load_done: data.load_done,
                rest_seconds_target: data.rest_seconds_target,
                rest_seconds_used: data.rest_seconds_used
            })
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: log as SetLog };
    } catch (error) {
        console.error('Error logging set:', error);
        return { success: false, error: 'Erro ao salvar série' };
    }
}

/**
 * Finish a session with final metrics
 */
export async function finishSession(
    sessionId: string,
    metrics: SessionMetrics
): Promise<ApiResponse<WorkoutSession>> {
    try {
        const { data, error } = await supabase
            .from('workout_sessions')
            .update({
                status: 'concluido',
                finished_at: new Date().toISOString(),
                total_duration_seconds: metrics.total_duration_seconds,
                total_volume: metrics.total_volume,
                total_sets: metrics.total_sets,
                total_exercises: metrics.total_exercises
            })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: data as WorkoutSession };
    } catch (error) {
        console.error('Error finishing session:', error);
        return { success: false, error: 'Erro ao finalizar sessão' };
    }
}

/**
 * Get active session for a student (for reconnection/recovery)
 */
export async function getActiveSession(
    studentId: string
): Promise<ApiResponse<WorkoutSession | null>> {
    try {
        const { data, error } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('student_id', studentId)
            .eq('status', 'em_andamento')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return { success: true, data: (data as WorkoutSession) || null };
    } catch (error) {
        console.error('Error fetching active session:', error);
        return { success: false, error: 'Erro ao buscar sessão ativa' };
    }
}

/**
 * Get session history for a student (paginated)
 */
export async function getSessionHistory(
    studentId: string,
    limit: number = 20
): Promise<ApiResponse<WorkoutSession[]>> {
    try {
        const { data, error } = await supabase
            .from('workout_sessions')
            .select(`
                *,
                workout_days!workout_sessions_workout_day_id_fkey(day_label, day_name)
            `)
            .eq('student_id', studentId)
            .eq('status', 'concluido')
            .order('started_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const enriched = (data || []).map(s => ({
            ...s,
            day_label: (s.workout_days as any)?.day_label,
            day_name: (s.workout_days as any)?.day_name
        }));

        return { success: true, data: enriched as WorkoutSession[] };
    } catch (error) {
        console.error('Error fetching session history:', error);
        return { success: false, error: 'Erro ao buscar histórico' };
    }
}

/**
 * Get full session detail with all set logs
 */
export async function getSessionDetail(
    sessionId: string
): Promise<ApiResponse<{ session: WorkoutSession; sets: SetLog[] }>> {
    try {
        const { data: session, error: sErr } = await supabase
            .from('workout_sessions')
            .select(`
                *,
                workout_days!workout_sessions_workout_day_id_fkey(day_label, day_name)
            `)
            .eq('id', sessionId)
            .single();

        if (sErr) throw sErr;

        const { data: sets, error: setErr } = await supabase
            .from('workout_set_logs')
            .select('*')
            .eq('session_id', sessionId)
            .order('completed_at', { ascending: true });

        if (setErr) throw setErr;

        return {
            success: true,
            data: {
                session: {
                    ...session,
                    day_label: (session.workout_days as any)?.day_label,
                    day_name: (session.workout_days as any)?.day_name
                } as WorkoutSession,
                sets: (sets || []) as SetLog[]
            }
        };
    } catch (error) {
        console.error('Error fetching session detail:', error);
        return { success: false, error: 'Erro ao buscar detalhes da sessão' };
    }
}

/**
 * Get last completed session for a specific workout day (for comparison)
 */
export async function getLastSessionForDay(
    studentId: string,
    dayId: string
): Promise<ApiResponse<{ session: WorkoutSession; sets: SetLog[] } | null>> {
    try {
        const { data: session, error: sErr } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('student_id', studentId)
            .eq('workout_day_id', dayId)
            .eq('status', 'concluido')
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (sErr) throw sErr;
        if (!session) return { success: true, data: null };

        const { data: sets, error: setErr } = await supabase
            .from('workout_set_logs')
            .select('*')
            .eq('session_id', session.id)
            .order('completed_at', { ascending: true });

        if (setErr) throw setErr;

        return {
            success: true,
            data: {
                session: session as WorkoutSession,
                sets: (sets || []) as SetLog[]
            }
        };
    } catch (error) {
        console.error('Error fetching last session:', error);
        return { success: false, error: 'Erro ao buscar última sessão' };
    }
}

/**
 * Get sets logged so far for an active session (for recovery)
 */
export async function getSessionSets(
    sessionId: string
): Promise<ApiResponse<SetLog[]>> {
    try {
        const { data, error } = await supabase
            .from('workout_set_logs')
            .select('*')
            .eq('session_id', sessionId)
            .order('completed_at', { ascending: true });

        if (error) throw error;
        return { success: true, data: (data || []) as SetLog[] };
    } catch (error) {
        console.error('Error fetching session sets:', error);
        return { success: false, error: 'Erro ao buscar séries' };
    }
}
