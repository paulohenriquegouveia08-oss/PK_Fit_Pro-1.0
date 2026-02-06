import { supabase } from './supabase';
import type { User, ApiResponse } from '../types';
import type { Workout, WorkoutDay } from './workout.service';

export interface StudentInfo {
    id: string;
    name: string;
    email: string;
    phone?: string;
    professor_name?: string;
    professor_id?: string;
    has_workout: boolean;
    workout?: Workout;
}

// Get current student's user ID from session storage
export function getCurrentStudentId(): string | null {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return null;

    try {
        const user = JSON.parse(userStr);
        return user.id || null;
    } catch {
        return null;
    }
}

// Get current student info from session storage
export function getCurrentStudentInfo(): User | null {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return null;

    try {
        return JSON.parse(userStr) as User;
    } catch {
        return null;
    }
}

// Get student's professor info
export async function getStudentProfessor(studentId: string): Promise<ApiResponse<{ id: string; name: string; email: string } | null>> {
    try {
        const { data, error } = await supabase
            .from('professor_students')
            .select(`
                professor_id,
                users!professor_students_professor_id_fkey(id, name, email)
            `)
            .eq('student_id', studentId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (!data || !data.users) {
            return { success: true, data: null };
        }

        const professor = data.users as any;
        return {
            success: true,
            data: {
                id: professor.id,
                name: professor.name,
                email: professor.email
            }
        };
    } catch (error) {
        console.error('Error fetching student professor:', error);
        return {
            success: false,
            error: 'Erro ao buscar professor'
        };
    }
}

// Get student's active workout with all days and exercises
export async function getStudentActiveWorkout(studentId: string): Promise<ApiResponse<Workout | null>> {
    try {
        // Get active workout
        const { data: workout, error: workoutError } = await supabase
            .from('workouts')
            .select('*')
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
                days: daysWithExercises
            }
        };
    } catch (error) {
        console.error('Error fetching student workout:', error);
        return {
            success: false,
            error: 'Erro ao buscar treino'
        };
    }
}

// Get complete student dashboard info
export async function getStudentDashboardInfo(studentId: string): Promise<ApiResponse<StudentInfo>> {
    try {
        // Get student info
        const { data: student, error: studentError } = await supabase
            .from('users')
            .select('*')
            .eq('id', studentId)
            .single();

        if (studentError) throw studentError;

        // Get professor
        const professorResult = await getStudentProfessor(studentId);

        // Get workout
        const workoutResult = await getStudentActiveWorkout(studentId);

        return {
            success: true,
            data: {
                id: student.id,
                name: student.name,
                email: student.email,
                phone: student.phone,
                professor_name: professorResult.data?.name,
                professor_id: professorResult.data?.id,
                has_workout: !!workoutResult.data,
                workout: workoutResult.data || undefined
            }
        };
    } catch (error) {
        console.error('Error fetching student dashboard info:', error);
        return {
            success: false,
            error: 'Erro ao carregar informações'
        };
    }
}
