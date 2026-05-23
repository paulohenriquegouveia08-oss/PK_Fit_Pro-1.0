import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import type { CreateAccessLogInput } from './access.schema.js';

const supabase = () => getSupabaseAdmin();

export async function insertAccessLog(data: CreateAccessLogInput) {
  const { data: log, error } = await supabase()
    .from('access_logs')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Erro ao registrar log de acesso: ${error.message}`);
  return log;
}

export async function fetchLastPresence(userId: string, academyId: string) {
  const { data, error } = await supabase()
    .from('access_logs')
    .select('created_at, access_granted, direction')
    .eq('user_id', userId)
    .eq('academy_id', academyId)
    .eq('access_granted', true)
    .eq('direction', 'IN')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Erro ao buscar última presença: ${error.message}`);
  }

  return data;
}

export async function checkAccessRules(academyId: string, userId: string) {
  // Check if academy is active
  const { data: academy, error: academyError } = await supabase()
    .from('academies')
    .select('is_active')
    .eq('id', academyId)
    .single();

  if (academyError || !academy || !academy.is_active) {
    return { granted: false, reason: 'BLOQUEADO', message: 'Academia inativa ou bloqueada' };
  }

  // Check user active
  const { data: user, error: userError } = await supabase()
    .from('academy_members')
    .select('is_active, role')
    .eq('user_id', userId)
    .eq('academy_id', academyId)
    .single();

  if (userError || !user) {
    return { granted: false, reason: 'NAO_ENCONTRADO', message: 'Usuário não encontrado' };
  }

  if (!user.is_active) {
    return { granted: false, reason: 'BLOQUEADO', message: 'Cadastro bloqueado' };
  }

  // If professor or admin, grant access immediately
  if (['ADMIN_ACADEMIA', 'PROFESSOR', 'RECEPCIONISTA'].includes(user.role)) {
    return { granted: true, reason: 'LIBERADO', message: 'Acesso liberado (Staff)' };
  }

  // Check student plans
  const { data: plan, error: planError } = await supabase()
    .from('student_plans')
    .select(`
      plan_start_date,
      plan_end_date,
      plans (
        name,
        has_time_restriction,
        allowed_start_time,
        allowed_end_time
      )
    `)
    .eq('student_id', userId)
    .eq('academy_id', academyId)
    .eq('is_active', true)
    .single();

  if (planError || !plan) {
    return { granted: false, reason: 'PLANO_VENCIDO', message: 'Nenhum plano ativo encontrado' };
  }

  const today = new Date().toISOString().split('T')[0];
  if (today > plan.plan_end_date) {
    return { granted: false, reason: 'PLANO_VENCIDO', message: 'Plano vencido' };
  }

  // Check payment for current month
  const monthStart = today.substring(0, 7) + '-01';
  const { data: payment } = await supabase()
    .from('payments')
    .select('id')
    .eq('student_id', userId)
    .eq('academy_id', academyId)
    .eq('status', 'pago')
    .gte('payment_date', monthStart)
    .lte('payment_date', today)
    .limit(1);

  if (!payment || payment.length === 0) {
    return { granted: false, reason: 'INADIMPLENTE', message: 'Pagamento pendente no mês atual' };
  }

  // Check time restriction
  const planData = plan.plans as any;
  if (planData.has_time_restriction && planData.allowed_start_time && planData.allowed_end_time) {
    const nowStr = new Date().toTimeString().substring(0, 8); // HH:MM:SS
    if (nowStr < planData.allowed_start_time || nowStr > planData.allowed_end_time) {
      return { granted: false, reason: 'FORA_DO_HORARIO', message: `Fora do horário permitido (${planData.allowed_start_time} - ${planData.allowed_end_time})` };
    }
  }

  return { granted: true, reason: 'LIBERADO', message: 'Acesso liberado' };
}
