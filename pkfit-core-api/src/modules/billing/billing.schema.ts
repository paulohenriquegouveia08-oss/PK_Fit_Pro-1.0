import { z } from 'zod';

export const createPaymentSchema = z.object({
  student_id: z.string().uuid().optional().nullable(),
  plan_id: z.string().uuid().optional().nullable(),
  amount: z.number().nonnegative('Valor deve ser não negativo'),
  status: z.enum(['pago', 'pendente', 'cancelado']),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)'),
  description: z.string().optional().nullable(),
});

export const markPlanPaidSchema = z.object({
  student_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  amount: z.number().nonnegative(),
  payment_method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'CASH']).optional(),
});

export const markPlanUnpaidSchema = z.object({
  student_id: z.string().uuid(),
  plan_id: z.string().uuid(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type MarkPlanPaidInput = z.infer<typeof markPlanPaidSchema>;
export type MarkPlanUnpaidInput = z.infer<typeof markPlanUnpaidSchema>;
