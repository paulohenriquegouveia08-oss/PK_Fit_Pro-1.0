import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import { countActiveStudentsForPlan, deletePlanDb, insertStudentPlan } from './plan.repository.js';
import type { CreatePlanInput, UpdatePlanInput, DeletePlanInput, CreateStudentPlanInput } from './plan.schema.js';
import type { AuthenticatedUser } from '../../types/common.types.js';

export function calculateEndDate(startDate: Date, durationInMonths: number): Date {
  const endDate = new Date(startDate);
  
  if (durationInMonths === -1) {
    endDate.setDate(endDate.getDate() + 1);
    return endDate;
  }
  
  if (durationInMonths === 0) {
    endDate.setDate(endDate.getDate() + 7);
    return endDate;
  }
  
  endDate.setMonth(endDate.getMonth() + durationInMonths);
  const expectedMonth = (startDate.getMonth() + durationInMonths) % 12;
  if (endDate.getMonth() !== expectedMonth) {
    endDate.setDate(0);
  }
  
  return endDate;
}

export function formatDateISO(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

export async function createPlan(input: CreatePlanInput, actor: AuthenticatedUser) {
  const supabase = getSupabaseAdmin();

  const insertData = {
    academy_id: actor.academy_id!,
    name: input.name.trim(),
    price: input.price,
    duration_in_months: input.duration_in_months,
    has_time_restriction: input.has_time_restriction,
    is_active: true,
    allowed_start_time: input.has_time_restriction ? input.allowed_start_time : null,
    allowed_end_time: input.has_time_restriction ? input.allowed_end_time : null,
  };

  const { data: plan, error } = await supabase
    .from('plans')
    .insert(insertData)
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar plano: ${error.message}`);
  return plan;
}

export async function updatePlan(input: UpdatePlanInput, actor: AuthenticatedUser) {
  const supabase = getSupabaseAdmin();
  
  const updateData: any = { ...input };
  delete updateData.id;

  if (input.has_time_restriction === false) {
    updateData.allowed_start_time = null;
    updateData.allowed_end_time = null;
  }

  const { data, error } = await supabase
    .from('plans')
    .update(updateData)
    .eq('id', input.id)
    .eq('academy_id', actor.academy_id!)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar plano: ${error.message}`);
  return data;
}

export async function deletePlan(input: DeletePlanInput, actor: AuthenticatedUser) {
  const count = await countActiveStudentsForPlan(input.id);
  
  if (count > 0) {
    throw new Error('Não é possível excluir um plano com alunos ativos vinculados');
  }

  await deletePlanDb(input.id, actor.academy_id!);
}

export async function createStudentPlan(input: CreateStudentPlanInput, actor: AuthenticatedUser) {
  const supabase = getSupabaseAdmin();

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', input.plan_id)
    .eq('academy_id', actor.academy_id!)
    .eq('is_active', true)
    .single();

  if (planError || !plan) {
    throw new Error('Plano não encontrado ou inativo');
  }

  const startDate = new Date();
  const endDate = calculateEndDate(startDate, plan.duration_in_months);

  const result = await insertStudentPlan({
    student_id: input.student_id,
    plan_id: input.plan_id,
    academy_id: actor.academy_id!,
    plan_start_date: formatDateISO(startDate),
    plan_end_date: formatDateISO(endDate)
  });

  return result;
}
