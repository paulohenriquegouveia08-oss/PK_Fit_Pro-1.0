import { insertPayment, findPaymentForCurrentMonth, cancelPayment } from './billing.repository.js';
import type { CreatePaymentInput, MarkPlanPaidInput, MarkPlanUnpaidInput } from './billing.schema.js';
import type { AuthenticatedUser } from '../../types/common.types.js';

export async function createPayment(input: CreatePaymentInput, actor: AuthenticatedUser) {
  const data = {
    academy_id: actor.academy_id!,
    student_id: input.student_id || null,
    plan_id: input.plan_id || null,
    amount: input.amount,
    status: input.status,
    payment_date: input.payment_date,
    description: input.description || null,
  };

  return await insertPayment(data);
}

export async function markStudentPlanAsPaid(input: MarkPlanPaidInput, actor: AuthenticatedUser) {
  const existing = await findPaymentForCurrentMonth(actor.academy_id!, input.student_id, input.plan_id);

  if (existing) {
    throw new Error('Pagamento já registrado para este período');
  }

  const today = new Date().toISOString().split('T')[0];

  const data = {
    academy_id: actor.academy_id!,
    student_id: input.student_id,
    plan_id: input.plan_id,
    amount: input.amount,
    status: 'pago',
    payment_method: input.payment_method || null,
    payment_date: today,
    description: 'Pagamento de plano',
  };

  return await insertPayment(data);
}

export async function markStudentPlanAsUnpaid(input: MarkPlanUnpaidInput, actor: AuthenticatedUser) {
  const existing = await findPaymentForCurrentMonth(actor.academy_id!, input.student_id, input.plan_id);

  if (!existing) {
    throw new Error('Nenhum pagamento encontrado neste período para estornar');
  }

  await cancelPayment(existing.id);
}
