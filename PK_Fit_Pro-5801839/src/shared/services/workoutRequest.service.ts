import { supabase } from './supabase';
import type { ApiResponse } from '../types';

export interface WorkoutRequest {
    id: string;
    student_id: string;
    professor_id: string;
    student_name?: string;
    student_email?: string;
    message: string;
    status: 'pending' | 'completed' | 'rejected';
    created_at: string;
    updated_at: string;
}

// Create a new workout request from student
export async function createWorkoutRequest(
    studentId: string,
    professorId: string,
    message: string
): Promise<ApiResponse<WorkoutRequest>> {
    try {
        const { data, error } = await supabase
            .from('workout_requests')
            .insert({
                student_id: studentId,
                professor_id: professorId,
                message: message,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, data };
    } catch (error) {
        console.error('Error creating workout request:', error);
        return { success: false, error: 'Erro ao enviar solicitação' };
    }
}

// Get pending requests for a professor
export async function getProfessorPendingRequests(professorId: string): Promise<ApiResponse<WorkoutRequest[]>> {
    try {
        const { data: requests, error } = await supabase
            .from('workout_requests')
            .select(`
                *,
                users!workout_requests_student_id_fkey(name, email)
            `)
            .eq('professor_id', professorId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map to include student info
        const enrichedRequests: WorkoutRequest[] = (requests || []).map(req => ({
            ...req,
            student_name: (req.users as any)?.name,
            student_email: (req.users as any)?.email
        }));

        return { success: true, data: enrichedRequests };
    } catch (error) {
        console.error('Error fetching pending requests:', error);
        return { success: false, error: 'Erro ao buscar solicitações' };
    }
}

// Get pending request count for professor (for notification badge)
export async function getProfessorPendingRequestCount(professorId: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('workout_requests')
            .select('*', { count: 'exact', head: true })
            .eq('professor_id', professorId)
            .eq('status', 'pending');

        if (error) throw error;

        return count || 0;
    } catch (error) {
        console.error('Error counting pending requests:', error);
        return 0;
    }
}

// Mark request as completed (when professor updates the workout)
export async function completeWorkoutRequest(requestId: string): Promise<ApiResponse<void>> {
    try {
        const { error } = await supabase
            .from('workout_requests')
            .update({
                status: 'completed',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error completing request:', error);
        return { success: false, error: 'Erro ao atualizar solicitação' };
    }
}

// Mark student's workout as updated (for notification)
export async function markWorkoutAsUpdated(studentId: string): Promise<ApiResponse<void>> {
    try {
        const { error } = await supabase
            .from('users')
            .update({
                workout_updated_at: new Date().toISOString(),
                workout_update_seen: false
            })
            .eq('id', studentId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error marking workout as updated:', error);
        return { success: false, error: 'Erro ao notificar aluno' };
    }
}

// Check if student has unseen workout update
export async function checkWorkoutUpdateNotification(studentId: string): Promise<{
    hasUpdate: boolean;
    updatedAt?: string;
}> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('workout_updated_at, workout_update_seen')
            .eq('id', studentId)
            .single();

        if (error) throw error;

        return {
            hasUpdate: data?.workout_update_seen === false,
            updatedAt: data?.workout_updated_at
        };
    } catch (error) {
        console.error('Error checking workout notification:', error);
        return { hasUpdate: false };
    }
}

// Mark workout update as seen by student
export async function markWorkoutUpdateAsSeen(studentId: string): Promise<ApiResponse<void>> {
    try {
        const { error } = await supabase
            .from('users')
            .update({ workout_update_seen: true })
            .eq('id', studentId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error marking update as seen:', error);
        return { success: false, error: 'Erro ao atualizar notificação' };
    }
}

// Reject a workout request
export async function rejectWorkoutRequest(requestId: string): Promise<ApiResponse<void>> {
    try {
        const { error } = await supabase
            .from('workout_requests')
            .update({
                status: 'rejected',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error rejecting request:', error);
        return { success: false, error: 'Erro ao rejeitar solicitação' };
    }
}
