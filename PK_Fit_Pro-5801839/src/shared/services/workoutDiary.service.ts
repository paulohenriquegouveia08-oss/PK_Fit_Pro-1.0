import { supabase } from './supabase';
import type { ApiResponse } from '../types';

// ============ Types ============

export interface WorkoutDiary {
    id: string;
    academy_id: string;
    student_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    exercises?: DiaryExercise[];
}

export interface DiaryExercise {
    id: string;
    academy_id: string;
    workout_diary_id: string;
    exercise_name: string;
    sets: number;
    repetitions: number;
    weight: number;
    unit: string;
    notes: string | null;
    set_number: number | null;
    rest_seconds: number | null;
    created_at: string;
}

export interface CreateDiaryData {
    academy_id: string;
    student_id: string;
    title: string;
    exercises: {
        exercise_name: string;
        sets: number;
        repetitions: number;
        weight: number;
        unit?: string;
        notes?: string;
        set_number?: number;
        rest_seconds?: number;
    }[];
}

// ============ Functions ============

/**
 * Create a workout diary with exercises (transaction-style)
 */
export async function createWorkoutDiary(data: CreateDiaryData): Promise<ApiResponse<WorkoutDiary>> {
    try {
        if (!data.title.trim()) {
            return { success: false, error: 'O título do treino é obrigatório' };
        }
        if (!data.exercises || data.exercises.length === 0) {
            return { success: false, error: 'Adicione pelo menos um exercício' };
        }
        for (const ex of data.exercises) {
            if (!ex.exercise_name.trim()) {
                return { success: false, error: 'O nome do exercício é obrigatório' };
            }
        }

        // 1. Create the diary entry
        const { data: diary, error: diaryError } = await supabase
            .from('workout_diaries')
            .insert({
                academy_id: data.academy_id,
                student_id: data.student_id,
                title: data.title.trim()
            })
            .select()
            .single();

        if (diaryError) throw diaryError;

        // 2. Create all exercises
        const exerciseRows = data.exercises.map(ex => ({
            academy_id: data.academy_id,
            workout_diary_id: diary.id,
            exercise_name: ex.exercise_name.trim(),
            sets: ex.sets || 0,
            repetitions: ex.repetitions || 0,
            weight: ex.weight || 0,
            unit: ex.unit || 'kg',
            notes: ex.notes?.trim() || null,
            set_number: ex.set_number ?? null,
            rest_seconds: ex.rest_seconds ?? null
        }));

        const { error: exError } = await supabase
            .from('workout_diary_exercises')
            .insert(exerciseRows);

        if (exError) {
            // Rollback: delete the diary if exercises fail
            await supabase.from('workout_diaries').delete().eq('id', diary.id);
            throw exError;
        }

        return { success: true, data: diary as WorkoutDiary };
    } catch (error) {
        console.error('Error creating workout diary:', error);
        return { success: false, error: 'Erro ao salvar diário de treino' };
    }
}

/**
 * Get all diaries for a student (list view, no exercises)
 */
export async function getStudentDiaries(
    studentId: string,
    academyId: string
): Promise<ApiResponse<WorkoutDiary[]>> {
    try {
        const { data, error } = await supabase
            .from('workout_diaries')
            .select('*')
            .eq('student_id', studentId)
            .eq('academy_id', academyId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, data: (data || []) as WorkoutDiary[] };
    } catch (error) {
        console.error('Error fetching student diaries:', error);
        return { success: false, error: 'Erro ao buscar diários' };
    }
}

/**
 * Get a single diary with its exercises (detail view)
 */
export async function getDiaryWithExercises(
    diaryId: string,
    academyId: string
): Promise<ApiResponse<WorkoutDiary>> {
    try {
        const { data: diary, error: dErr } = await supabase
            .from('workout_diaries')
            .select('*')
            .eq('id', diaryId)
            .eq('academy_id', academyId)
            .single();

        if (dErr) throw dErr;

        const { data: exercises, error: eErr } = await supabase
            .from('workout_diary_exercises')
            .select('*')
            .eq('workout_diary_id', diaryId)
            .eq('academy_id', academyId)
            .order('created_at', { ascending: true });

        if (eErr) throw eErr;

        return {
            success: true,
            data: { ...diary, exercises: exercises || [] } as WorkoutDiary
        };
    } catch (error) {
        console.error('Error fetching diary details:', error);
        return { success: false, error: 'Erro ao buscar detalhes do diário' };
    }
}

/**
 * Delete a diary and its exercises
 */
export async function deleteWorkoutDiary(
    diaryId: string,
    academyId: string
): Promise<ApiResponse<void>> {
    try {
        // 1. Delete exercises first (RLS may block CASCADE on child table)
        const { error: exError } = await supabase
            .from('workout_diary_exercises')
            .delete()
            .eq('workout_diary_id', diaryId)
            .eq('academy_id', academyId);

        if (exError) {
            console.error('Error deleting exercises:', exError);
        }

        // 2. Delete the diary entry itself
        const { error } = await supabase
            .from('workout_diaries')
            .delete()
            .eq('id', diaryId)
            .eq('academy_id', academyId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error deleting diary:', error);
        return { success: false, error: 'Erro ao excluir diário' };
    }
}

/**
 * Get diary count for a student
 */
export async function getStudentDiaryCount(
    studentId: string,
    academyId: string
): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('workout_diaries')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .eq('academy_id', academyId);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error counting diaries:', error);
        return 0;
    }
}
