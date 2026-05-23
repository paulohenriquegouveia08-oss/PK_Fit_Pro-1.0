import { z } from 'zod';

export const validateAccessSchema = z.object({
  academy_id: z.string().uuid('Academy ID inválido'),
  user_id: z.string().uuid('User ID inválido'),
});

export const createAccessLogSchema = z.object({
  academy_id: z.string().uuid('Academy ID inválido'),
  user_id: z.string().uuid('User ID inválido').optional(),
  turnstile_config_id: z.string().uuid().optional(),
  direction: z.enum(['IN', 'OUT']),
  access_granted: z.boolean(),
  denial_reason: z.enum(['INADIMPLENTE', 'BLOQUEADO', 'FORA_DO_HORARIO', 'PLANO_VENCIDO', 'NAO_ENCONTRADO']).optional().nullable(),
  identification_method: z.enum(['BIOMETRIC', 'CARD', 'QR_CODE', 'FACIAL', 'MANUAL']).optional().nullable(),
  raw_credential: z.string().optional().nullable(),
  user_name: z.string().optional().nullable(),
});

export type ValidateAccessInput = z.infer<typeof validateAccessSchema>;
export type CreateAccessLogInput = z.infer<typeof createAccessLogSchema>;
