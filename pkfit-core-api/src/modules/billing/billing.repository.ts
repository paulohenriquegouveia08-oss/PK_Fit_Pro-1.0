import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';

const supabase = () => getSupabaseAdmin();

export async function insertPayment(data: any) {
  const { data: payment, error } = await supabase()
    .from('payments')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Erro ao registrar pagamento: ${error.message}`);
  return payment;
}

export async function findPaymentForCurrentMonth(academyId: string, studentId: string, planId: string) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';

  const { data, error } = await supabase()
    .from('payments')
    .select('id, status')
    .eq('academy_id', academyId)
    .eq('student_id', studentId)
    .eq('plan_id', planId)
    .eq('status', 'pago')
    .gte('payment_date', monthStart)
    .lte('payment_date', today)
    .limit(1);

  if (error) throw new Error(`Erro ao verificar pagamento: ${error.message}`);
  return data && data.length > 0 ? data[0] : null;
}

export async function cancelPayment(paymentId: string) {
  const { error } = await supabase()
    .from('payments')
    .update({ status: 'cancelado' })
    .eq('id', paymentId);

  if (error) throw new Error(`Erro ao estornar pagamento: ${error.message}`);
}
