import { supabase } from './supabase';
import type { ApiResponse } from '../types';

// ==========================================
// TIPOS
// ==========================================

export interface Feedback {
    id: string;
    academy_id: string;
    student_id: string;
    professor_id: string;
    rating: number;
    description: string;
    created_at: string;
    student_name?: string;
    professor_name?: string;
}

export interface ProfessorRating {
    professor_id: string;
    professor_name: string;
    average_rating: number;
    total_feedbacks: number;
}

export interface CreateFeedbackData {
    academy_id: string;
    student_id: string;
    professor_id: string;
    rating: number;
    description: string;
}

// ==========================================
// CRIAR FEEDBACK
// ==========================================

export async function createFeedback(data: CreateFeedbackData): Promise<ApiResponse<Feedback>> {
    try {
        if (data.rating < 1 || data.rating > 5) {
            return { success: false, error: 'Avaliação deve ser entre 1 e 5 estrelas' };
        }
        if (!data.description || data.description.trim().length < 10) {
            return { success: false, error: 'Descrição deve ter no mínimo 10 caracteres' };
        }

        const { data: feedback, error } = await supabase
            .from('feedbacks')
            .insert({
                academy_id: data.academy_id,
                student_id: data.student_id,
                professor_id: data.professor_id,
                rating: data.rating,
                description: data.description.trim()
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return { success: false, error: 'Você já avaliou este professor' };
            }
            throw error;
        }
        return { success: true, data: feedback as Feedback };
    } catch (error) {
        console.error('Error creating feedback:', error);
        return { success: false, error: 'Erro ao enviar feedback' };
    }
}

// ==========================================
// VERIFICAR SE JÁ AVALIOU
// ==========================================

export async function checkExistingFeedback(
    studentId: string,
    professorId: string
): Promise<boolean> {
    try {
        const { count } = await supabase
            .from('feedbacks')
            .select('*', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .eq('professor_id', professorId);

        return (count || 0) > 0;
    } catch {
        return false;
    }
}

// ==========================================
// FEEDBACKS DO ALUNO
// ==========================================

export async function getStudentFeedbacks(
    studentId: string
): Promise<ApiResponse<Feedback[]>> {
    try {
        const { data, error } = await supabase
            .from('feedbacks')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enriquecer com nome do professor
        const enriched: Feedback[] = [];
        for (const fb of data || []) {
            const { data: prof } = await supabase
                .from('users')
                .select('name')
                .eq('id', fb.professor_id)
                .single();

            enriched.push({
                ...fb,
                professor_name: prof?.name || 'Desconhecido'
            });
        }

        return { success: true, data: enriched };
    } catch (error) {
        console.error('Error fetching student feedbacks:', error);
        return { success: false, error: 'Erro ao buscar feedbacks' };
    }
}

// ==========================================
// FEEDBACKS DO PROFESSOR
// ==========================================

export async function getProfessorFeedbacks(
    professorId: string
): Promise<ApiResponse<Feedback[]>> {
    try {
        const { data, error } = await supabase
            .from('feedbacks')
            .select('*')
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const enriched: Feedback[] = [];
        for (const fb of data || []) {
            const { data: student } = await supabase
                .from('users')
                .select('name')
                .eq('id', fb.student_id)
                .single();

            enriched.push({
                ...fb,
                student_name: student?.name || 'Desconhecido'
            });
        }

        return { success: true, data: enriched };
    } catch (error) {
        console.error('Error fetching professor feedbacks:', error);
        return { success: false, error: 'Erro ao buscar feedbacks' };
    }
}

// ==========================================
// MÉDIA DO PROFESSOR
// ==========================================

export async function getProfessorAverageRating(
    professorId: string
): Promise<{ average: number; total: number }> {
    try {
        const { data, error } = await supabase
            .from('feedbacks')
            .select('rating')
            .eq('professor_id', professorId);

        if (error) throw error;

        const ratings = data || [];
        if (ratings.length === 0) return { average: 0, total: 0 };

        const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
        return {
            average: Math.round((sum / ratings.length) * 10) / 10,
            total: ratings.length
        };
    } catch {
        return { average: 0, total: 0 };
    }
}

// ==========================================
// RANKINGS DA ACADEMIA (ADMIN)
// ==========================================

export async function getAcademyProfessorsWithRatings(
    academyId: string
): Promise<ApiResponse<ProfessorRating[]>> {
    try {
        // Buscar feedbacks da academia
        const { data: feedbacks, error } = await supabase
            .from('feedbacks')
            .select('professor_id, rating')
            .eq('academy_id', academyId);

        if (error) throw error;

        // Agrupar por professor
        const grouped = new Map<string, number[]>();
        for (const fb of feedbacks || []) {
            if (!grouped.has(fb.professor_id)) grouped.set(fb.professor_id, []);
            grouped.get(fb.professor_id)!.push(fb.rating);
        }

        // Buscar nomes e calcular médias
        const result: ProfessorRating[] = [];
        for (const [profId, ratings] of grouped) {
            const { data: prof } = await supabase
                .from('users')
                .select('name')
                .eq('id', profId)
                .single();

            const sum = ratings.reduce((a, b) => a + b, 0);
            result.push({
                professor_id: profId,
                professor_name: prof?.name || 'Desconhecido',
                average_rating: Math.round((sum / ratings.length) * 10) / 10,
                total_feedbacks: ratings.length
            });
        }

        // Ordenar por média desc
        result.sort((a, b) => b.average_rating - a.average_rating);

        return { success: true, data: result };
    } catch (error) {
        console.error('Error fetching academy ratings:', error);
        return { success: false, error: 'Erro ao buscar avaliações' };
    }
}

// ==========================================
// FEEDBACKS INDIVIDUAIS POR PROFESSOR (ADMIN)
// ==========================================

export async function getAcademyProfessorFeedbacks(
    academyId: string,
    professorId: string
): Promise<ApiResponse<Feedback[]>> {
    try {
        const { data, error } = await supabase
            .from('feedbacks')
            .select('*')
            .eq('academy_id', academyId)
            .eq('professor_id', professorId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const enriched: Feedback[] = [];
        for (const fb of data || []) {
            const { data: student } = await supabase
                .from('users')
                .select('name')
                .eq('id', fb.student_id)
                .single();

            enriched.push({
                ...fb,
                student_name: student?.name || 'Desconhecido'
            });
        }

        return { success: true, data: enriched };
    } catch (error) {
        console.error('Error fetching professor feedbacks:', error);
        return { success: false, error: 'Erro ao buscar feedbacks do professor' };
    }
}

// ==========================================
// PROFESSORES DA ACADEMIA (para aluno avaliar)
// ==========================================

export async function getAcademyProfessorsList(
    academyId: string
): Promise<ApiResponse<{ id: string; name: string; email: string }[]>> {
    try {
        // Use same pattern as working getAcademyProfessors in academyMember.service
        const { data: academyUsers, error: auError } = await supabase
            .from('academy_users')
            .select('user_id')
            .eq('academy_id', academyId);

        if (auError) throw auError;

        if (!academyUsers || academyUsers.length === 0) {
            return { success: true, data: [] };
        }

        const userIds = academyUsers.map(au => au.user_id);

        const { data, error } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', userIds)
            .eq('role', 'PROFESSOR')
            .eq('is_active', true)
            .order('name', { ascending: true });

        if (error) throw error;

        return {
            success: true,
            data: (data || []).map(u => ({ id: u.id, name: u.name, email: u.email }))
        };
    } catch (error) {
        console.error('Error fetching professors list:', error);
        return { success: false, error: 'Erro ao buscar professores' };
    }
}
