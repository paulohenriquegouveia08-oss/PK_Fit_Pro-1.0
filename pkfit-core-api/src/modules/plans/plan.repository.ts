import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';

const supabase = () => getSupabaseAdmin();

export async function countActiveStudentsForPlan(planId: string): Promise<number> {
  const { count, error } = await supabase()
    .from('student_plans')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .eq('is_active', true);

  if (error) throw new Error(`Erro ao checar alunos vinculados: ${error.message}`);
  return count || 0;
}

export async function deletePlanDb(planId: string, academyId: string) {
  const { error } = await supabase()
    .from('plans')
    .delete()
    .eq('id', planId)
    .eq('academy_id', academyId);

  if (error) throw new Error(`Erro ao excluir plano: ${error.message}`);
}

export async function insertStudentPlan(data: { student_id: string; plan_id: string; academy_id: string; plan_start_date: string; plan_end_date: string }) {
  // Disable old active plans for this student
  await supabase()
    .from('student_plans')
    .update({ is_active: false })
    .eq('student_id', data.student_id)
    .eq('is_active', true);

  // Insert new
  const { data: result, error } = await supabase()
    .from('student_plans')
    .insert({
      ...data,
      is_active: true
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao vincular plano ao aluno: ${error.message}`);
  return result;
}
