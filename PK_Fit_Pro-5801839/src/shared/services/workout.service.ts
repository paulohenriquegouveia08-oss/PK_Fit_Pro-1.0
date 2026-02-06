import { supabase } from './supabase';
import type { ApiResponse } from '../types';

export interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: string;
    rest: number;
    load: string;
    notes?: string;
}

export interface WorkoutDay {
    id: string;
    day_label: string; // "A", "B", "C", etc.
    day_name: string;  // "Peito e Tríceps", "Costas e Bíceps", etc.
    exercises: Exercise[];
}

export interface Workout {
    id: string;
    student_id: string;
    professor_id: string;
    student_name?: string;
    days: WorkoutDay[];
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

export interface CreateWorkoutData {
    student_id: string;
    professor_id: string;
    days: Omit<WorkoutDay, 'id'>[];
}

// Get current professor's user ID from session storage
function getCurrentProfessorId(): string | null {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return null;

    try {
        const user = JSON.parse(userStr);
        return user.id || null;
    } catch {
        return null;
    }
}

// Create a new workout for a student
export async function createWorkout(data: CreateWorkoutData): Promise<ApiResponse<Workout>> {
    try {
        // First, deactivate any existing active workouts for this student
        await supabase
            .from('workouts')
            .update({ is_active: false })
            .eq('student_id', data.student_id)
            .eq('is_active', true);

        // Create the new workout
        const { data: workout, error: workoutError } = await supabase
            .from('workouts')
            .insert({
                student_id: data.student_id,
                professor_id: data.professor_id,
                is_active: true
            })
            .select()
            .single();

        if (workoutError) throw workoutError;

        // Create workout days
        for (const day of data.days) {
            const { data: workoutDay, error: dayError } = await supabase
                .from('workout_days')
                .insert({
                    workout_id: workout.id,
                    day_label: day.day_label,
                    day_name: day.day_name
                })
                .select()
                .single();

            if (dayError) throw dayError;

            // Create exercises for this day
            if (day.exercises.length > 0) {
                const exercisesData = day.exercises.map((ex, index) => ({
                    workout_day_id: workoutDay.id,
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    rest_seconds: ex.rest,
                    load: ex.load,
                    notes: ex.notes || null,
                    order_index: index
                }));

                const { error: exercisesError } = await supabase
                    .from('exercises')
                    .insert(exercisesData);

                if (exercisesError) throw exercisesError;
            }
        }

        return {
            success: true,
            data: workout as Workout
        };
    } catch (error) {
        console.error('Error creating workout:', error);
        return {
            success: false,
            error: 'Erro ao criar treino'
        };
    }
}

// Get active workout for a student
export async function getStudentWorkout(studentId: string): Promise<ApiResponse<Workout | null>> {
    try {
        const { data: workout, error: workoutError } = await supabase
            .from('workouts')
            .select(`
                *,
                users!workouts_student_id_fkey(name)
            `)
            .eq('student_id', studentId)
            .eq('is_active', true)
            .single();

        if (workoutError && workoutError.code !== 'PGRST116') throw workoutError;

        if (!workout) {
            return { success: true, data: null };
        }

        // Get workout days
        const { data: days, error: daysError } = await supabase
            .from('workout_days')
            .select('*')
            .eq('workout_id', workout.id)
            .order('day_label', { ascending: true });

        if (daysError) throw daysError;

        // Get exercises for each day
        const daysWithExercises: WorkoutDay[] = [];
        for (const day of days || []) {
            const { data: exercises, error: exError } = await supabase
                .from('exercises')
                .select('*')
                .eq('workout_day_id', day.id)
                .order('order_index', { ascending: true });

            if (exError) throw exError;

            daysWithExercises.push({
                id: day.id,
                day_label: day.day_label,
                day_name: day.day_name,
                exercises: (exercises || []).map(ex => ({
                    id: ex.id,
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    rest: ex.rest_seconds,
                    load: ex.load,
                    notes: ex.notes
                }))
            });
        }

        return {
            success: true,
            data: {
                ...workout,
                student_name: (workout.users as any)?.name,
                days: daysWithExercises
            }
        };
    } catch (error) {
        console.error('Error fetching workout:', error);
        return {
            success: false,
            error: 'Erro ao buscar treino'
        };
    }
}

// Get all workouts created by a professor
export async function getProfessorWorkouts(): Promise<ApiResponse<Workout[]>> {
    const professorId = getCurrentProfessorId();
    if (!professorId) {
        return { success: false, error: 'Professor não identificado' };
    }

    try {
        const { data: workouts, error } = await supabase
            .from('workouts')
            .select(`
                *,
                users!workouts_student_id_fkey(name)
            `)
            .eq('professor_id', professorId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return {
            success: true,
            data: (workouts || []).map(w => ({
                ...w,
                student_name: (w.users as any)?.name,
                days: []
            }))
        };
    } catch (error) {
        console.error('Error fetching professor workouts:', error);
        return {
            success: false,
            error: 'Erro ao buscar treinos'
        };
    }
}

// Delete a workout
export async function deleteWorkout(workoutId: string): Promise<ApiResponse<void>> {
    try {
        const { error } = await supabase
            .from('workouts')
            .delete()
            .eq('id', workoutId);

        if (error) throw error;

        return { success: true, data: undefined };
    } catch (error) {
        console.error('Error deleting workout:', error);
        return {
            success: false,
            error: 'Erro ao excluir treino'
        };
    }
}

// Update an existing workout
export async function updateWorkout(
    workoutId: string,
    days: Omit<WorkoutDay, 'id'>[]
): Promise<ApiResponse<Workout>> {
    try {
        // Delete existing days (cascade will delete exercises)
        await supabase
            .from('workout_days')
            .delete()
            .eq('workout_id', workoutId);

        // Create new workout days
        for (const day of days) {
            const { data: workoutDay, error: dayError } = await supabase
                .from('workout_days')
                .insert({
                    workout_id: workoutId,
                    day_label: day.day_label,
                    day_name: day.day_name
                })
                .select()
                .single();

            if (dayError) throw dayError;

            // Create exercises for this day
            if (day.exercises.length > 0) {
                const exercisesData = day.exercises.map((ex, index) => ({
                    workout_day_id: workoutDay.id,
                    name: ex.name,
                    sets: ex.sets,
                    reps: ex.reps,
                    rest_seconds: ex.rest,
                    load: ex.load,
                    notes: ex.notes || null,
                    order_index: index
                }));

                const { error: exercisesError } = await supabase
                    .from('exercises')
                    .insert(exercisesData);

                if (exercisesError) throw exercisesError;
            }
        }

        // Update the workout timestamp
        const { data: workout, error: updateError } = await supabase
            .from('workouts')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', workoutId)
            .select()
            .single();

        if (updateError) throw updateError;

        return {
            success: true,
            data: workout as Workout
        };
    } catch (error) {
        console.error('Error updating workout:', error);
        return {
            success: false,
            error: 'Erro ao atualizar treino'
        };
    }
}
