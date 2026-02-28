import { supabase } from './supabase';
import type { Plan, StudentPlan, ApiResponse } from '../types';

// ==========================================
// TIPOS
// ==========================================

export interface CreatePlanData {
    academy_id: string;
    name: string;
    price: number;
    duration_in_months: number;
    has_time_restriction: boolean;
    allowed_start_time?: string;
    allowed_end_time?: string;
}

// ==========================================
// FUNÇÕES DE PLANOS
// ==========================================

// Buscar planos da academia
export async function getAcademyPlans(
    academyId: string,
    activeOnly: boolean = false
): Promise<ApiResponse<Plan[]>> {
    try {
        let query = supabase
            .from('plans')
            .select('*')
            .eq('academy_id', academyId)
            .order('created_at', { ascending: false });

        if (activeOnly) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        return {
            success: true,
            data: (data || []) as Plan[]
        };
    } catch (error) {
        console.error('Error fetching plans:', error);
        return {
            success: false,
            error: 'Erro ao buscar planos'
        };
    }
}

// Criar plano
export async function createPlan(data: CreatePlanData): Promise<ApiResponse<Plan>> {
    try {
        // Validações
        if (!data.academy_id) {
            return { success: false, error: 'Academy ID é obrigatório' };
        }
        if (!data.name || data.name.trim() === '') {
            return { success: false, error: 'Nome do plano é obrigatório' };
        }
        if (data.duration_in_months < 0) {
            return { success: false, error: 'Duração inválida' };
        }
        if (data.has_time_restriction) {
            if (!data.allowed_start_time || !data.allowed_end_time) {
                return { success: false, error: 'Horários são obrigatórios quando há restrição de horário' };
            }
            if (data.allowed_end_time <= data.allowed_start_time) {
                return { success: false, error: 'Horário final deve ser maior que horário inicial' };
            }
        }

        const insertData: Record<string, unknown> = {
            academy_id: data.academy_id,
            name: data.name.trim(),
            price: data.price,
            duration_in_months: data.duration_in_months,
            has_time_restriction: data.has_time_restriction,
            is_active: true
        };

        if (data.has_time_restriction) {
            insertData.allowed_start_time = data.allowed_start_time;
            insertData.allowed_end_time = data.allowed_end_time;
        } else {
            insertData.allowed_start_time = null;
            insertData.allowed_end_time = null;
        }

        const { data: plan, error } = await supabase
            .from('plans')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            data: plan as Plan
        };
    } catch (error) {
        console.error('Error creating plan:', error);
        return {
            success: false,
            error: 'Erro ao criar plano'
        };
    }
}

// Atualizar plano (não afeta contratos ativos)
export async function updatePlan(
    id: string,
    updates: Partial<Pick<Plan, 'name' | 'price' | 'duration_in_months' | 'has_time_restriction' | 'allowed_start_time' | 'allowed_end_time'>>
): Promise<ApiResponse<Plan>> {
    try {
        // Validações
        if (updates.duration_in_months !== undefined && updates.duration_in_months < 0) {
            return { success: false, error: 'Duração inválida' };
        }
        if (updates.has_time_restriction === true) {
            if (!updates.allowed_start_time || !updates.allowed_end_time) {
                return { success: false, error: 'Horários são obrigatórios quando há restrição de horário' };
            }
            if (updates.allowed_end_time <= updates.allowed_start_time) {
                return { success: false, error: 'Horário final deve ser maior que horário inicial' };
            }
        }

        const updateData: Record<string, unknown> = { ...updates };

        if (updates.has_time_restriction === false) {
            updateData.allowed_start_time = null;
            updateData.allowed_end_time = null;
        }

        const { data, error } = await supabase
            .from('plans')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            data: data as Plan
        };
    } catch (error) {
        console.error('Error updating plan:', error);
        return {
            success: false,
            error: 'Erro ao atualizar plano'
        };
    }
}

// Toggle status do plano
export async function togglePlanStatus(id: string, isActive: boolean): Promise<ApiResponse<Plan>> {
    return updatePlan(id, { is_active: isActive } as any);
}

// Excluir plano (só se não tem alunos vinculados)
export async function deletePlan(id: string): Promise<ApiResponse<void>> {
    try {
        // Verificar se tem alunos vinculados
        const { count } = await supabase
            .from('student_plans')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', id)
            .eq('is_active', true);

        if (count && count > 0) {
            return {
                success: false,
                error: 'Não é possível excluir um plano com alunos ativos vinculados'
            };
        }

        const { error } = await supabase
            .from('plans')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return { success: true, data: undefined };
    } catch (error) {
        console.error('Error deleting plan:', error);
        return {
            success: false,
            error: 'Erro ao excluir plano'
        };
    }
}

// ==========================================
// FUNÇÕES DE STUDENT PLANS
// ==========================================

// Calcular data de término baseado na duração
// duration_in_months = 0 significa semanal (7 dias)
export function calculateEndDate(startDate: Date, durationInMonths: number): Date {
    const endDate = new Date(startDate);

    // Semanal: 0 = 7 dias
    if (durationInMonths === 0) {
        endDate.setDate(endDate.getDate() + 7);
        return endDate;
    }

    endDate.setMonth(endDate.getMonth() + durationInMonths);

    // Se o dia mudou (ex: 31 jan + 1 mês = 3 mar em vez de 28 fev),
    // ajustar para último dia do mês correto
    const expectedMonth = (startDate.getMonth() + durationInMonths) % 12;
    if (endDate.getMonth() !== expectedMonth) {
        // Voltar para o último dia do mês anterior
        endDate.setDate(0);
    }

    return endDate;
}

// Formatar data para DD/MM/YYYY
export function formatDateBR(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Formatar data para YYYY-MM-DD (para banco de dados)
export function formatDateISO(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

// Criar vínculo aluno-plano
export async function createStudentPlan(
    studentId: string,
    planId: string,
    academyId: string
): Promise<ApiResponse<StudentPlan>> {
    try {
        // Buscar dados do plano
        const { data: plan, error: planError } = await supabase
            .from('plans')
            .select('*')
            .eq('id', planId)
            .eq('academy_id', academyId)
            .eq('is_active', true)
            .single();

        if (planError || !plan) {
            return {
                success: false,
                error: 'Plano não encontrado ou inativo'
            };
        }

        // Calcular datas
        const startDate = new Date();
        const endDate = calculateEndDate(startDate, plan.duration_in_months);

        // Desativar planos anteriores do aluno
        await supabase
            .from('student_plans')
            .update({ is_active: false })
            .eq('student_id', studentId)
            .eq('is_active', true);

        // Criar novo vínculo
        const { data, error } = await supabase
            .from('student_plans')
            .insert({
                student_id: studentId,
                plan_id: planId,
                academy_id: academyId,
                plan_start_date: formatDateISO(startDate),
                plan_end_date: formatDateISO(endDate),
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;

        return {
            success: true,
            data: data as StudentPlan
        };
    } catch (error) {
        console.error('Error creating student plan:', error);
        return {
            success: false,
            error: 'Erro ao vincular plano ao aluno'
        };
    }
}

// Buscar plano ativo do aluno
export async function getStudentActivePlan(studentId: string): Promise<ApiResponse<StudentPlan | null>> {
    try {
        const { data, error } = await supabase
            .from('student_plans')
            .select(`
                *,
                plans (
                    name,
                    price,
                    duration_in_months,
                    has_time_restriction,
                    allowed_start_time,
                    allowed_end_time
                )
            `)
            .eq('student_id', studentId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (!data) {
            return { success: true, data: null };
        }

        const planData = data.plans as any;
        const studentPlan: StudentPlan = {
            id: data.id,
            student_id: data.student_id,
            plan_id: data.plan_id,
            academy_id: data.academy_id,
            plan_start_date: data.plan_start_date,
            plan_end_date: data.plan_end_date,
            is_active: data.is_active,
            created_at: data.created_at,
            plan_name: planData?.name,
            plan_price: planData?.price,
            plan_duration: planData?.duration_in_months,
            plan_has_time_restriction: planData?.has_time_restriction,
            plan_allowed_start_time: planData?.allowed_start_time,
            plan_allowed_end_time: planData?.allowed_end_time
        };

        return {
            success: true,
            data: studentPlan
        };
    } catch (error) {
        console.error('Error fetching student plan:', error);
        return {
            success: false,
            error: 'Erro ao buscar plano do aluno'
        };
    }
}
