import { supabase } from './supabase';
import type { User, ApiResponse } from '../types';

export interface ProfessorStudent extends User {
    has_workout: boolean;
    last_workout_date?: string;
}

// Get current professor's user ID from session storage
export function getCurrentProfessorId(): string | null {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return null;

    try {
        const user = JSON.parse(userStr);
        return user.id || null;
    } catch {
        return null;
    }
}

// Get students assigned to the current professor
export async function getProfessorStudents(professorId: string): Promise<ApiResponse<ProfessorStudent[]>> {
    try {
        // Get student IDs from professor_students table
        const { data: relationships, error: relError } = await supabase
            .from('professor_students')
            .select('student_id')
            .eq('professor_id', professorId);

        if (relError) throw relError;

        if (!relationships || relationships.length === 0) {
            return { success: true, data: [] };
        }

        const studentIds = relationships.map(r => r.student_id);

        // Get student details
        const { data: students, error: studentsError } = await supabase
            .from('users')
            .select('*')
            .in('id', studentIds)
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (studentsError) throw studentsError;

        // Check which students have active workouts
        const { data: activeWorkouts, error: workoutsError } = await supabase
            .from('workouts')
            .select('student_id, created_at')
            .in('student_id', studentIds)
            .eq('is_active', true);

        if (workoutsError) {
            console.log('Note: workouts table may not exist yet:', workoutsError.message);
        }

        // Create a map of student_id to workout info
        const workoutMap = new Map<string, { has_workout: boolean; created_at?: string }>();
        if (activeWorkouts) {
            for (const workout of activeWorkouts) {
                workoutMap.set(workout.student_id, {
                    has_workout: true,
                    created_at: workout.created_at
                });
            }
        }

        // Combine student data with workout status
        const studentsWithWorkout: ProfessorStudent[] = (students || []).map(student => ({
            ...student,
            has_workout: workoutMap.get(student.id)?.has_workout || false,
            last_workout_date: workoutMap.get(student.id)?.created_at
        }));

        return {
            success: true,
            data: studentsWithWorkout
        };
    } catch (error) {
        console.error('Error fetching professor students:', error);
        return {
            success: false,
            error: 'Erro ao buscar alunos'
        };
    }
}

// Get professor stats
export async function getProfessorStats(professorId: string): Promise<{
    studentCount: number;
    workoutCount: number;
    pendingRequests: number;
}> {
    try {
        // Count students
        const { count: studentCount } = await supabase
            .from('professor_students')
            .select('*', { count: 'exact', head: true })
            .eq('professor_id', professorId);

        // Count active workouts created by this professor
        let workoutCount = 0;
        try {
            const { count } = await supabase
                .from('workouts')
                .select('*', { count: 'exact', head: true })
                .eq('professor_id', professorId)
                .eq('is_active', true);
            workoutCount = count || 0;
        } catch {
            // Table may not exist yet
        }

        return {
            studentCount: studentCount || 0,
            workoutCount: workoutCount,
            pendingRequests: 0 // TODO: Count from requests table
        };
    } catch (error) {
        console.error('Error fetching professor stats:', error);
        return {
            studentCount: 0,
            workoutCount: 0,
            pendingRequests: 0
        };
    }
}
