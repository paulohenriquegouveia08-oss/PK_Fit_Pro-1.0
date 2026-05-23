import { z } from 'zod';

const basePlanSchema = z.object({
  name: z.string().min(2, 'Nome do plano deve ter no mínimo 2 caracteres').max(100),
  price: z.number().nonnegative('Preço deve ser maior ou igual a zero'),
  duration_in_months: z.number().min(-1, 'Duração inválida'),
  has_time_restriction: z.boolean().default(false),
  allowed_start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Horário inicial inválido').optional().nullable(),
  allowed_end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Horário final inválido').optional().nullable(),
});

export const createPlanSchema = basePlanSchema.refine(data => {
  if (data.has_time_restriction) {
    if (!data.allowed_start_time || !data.allowed_end_time) return false;
    return data.allowed_end_time > data.allowed_start_time;
  }
  return true;
}, {
  message: 'Horários obrigatórios e o final deve ser maior que o inicial quando há restrição.',
  path: ['has_time_restriction'],
});

export const updatePlanSchema = basePlanSchema.partial().extend({
  id: z.string().uuid('ID inválido'),
});

export const deletePlanSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export const createStudentPlanSchema = z.object({
  student_id: z.string().uuid('ID de aluno inválido'),
  plan_id: z.string().uuid('ID de plano inválido'),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type DeletePlanInput = z.infer<typeof deletePlanSchema>;
export type CreateStudentPlanInput = z.infer<typeof createStudentPlanSchema>;
