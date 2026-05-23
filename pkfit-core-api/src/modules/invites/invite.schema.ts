import { z } from 'zod';

// ==========================================
// REQUEST SCHEMAS
// ==========================================

export const createInviteSchema = z.object({
  type: z.enum(['academy_invite', 'teacher_invite', 'student_invite'], {
    required_error: 'Tipo de convite é obrigatório',
    invalid_type_error: 'Tipo de convite inválido',
  }),
  academy_id: z.string().uuid('academy_id deve ser um UUID válido').nullable().optional(),
  metadata: z
    .object({
      plan_name: z.string().optional(),
      plan_value: z.number().positive().optional(),
      student_limit: z.number().int().positive().optional(),
      professor_id: z.string().uuid().optional(),
      notes: z.string().max(500).optional(),
    })
    .optional()
    .default({}),
  max_uses: z.number().int().min(1).max(100).default(1),
  // Override default expiration (in hours). If not provided, uses INVITE_EXPIRATION_HOURS.
  custom_expiration_hours: z.number().positive().max(168).optional(),
});

export const validateInviteSchema = z.object({
  code: z
    .string()
    .min(12, 'Código de convite muito curto')
    .max(20, 'Código de convite muito longo')
    .transform((v) => v.toUpperCase().trim()),
});

export const redeemInviteSchema = z.object({
  code: z
    .string()
    .min(12, 'Código de convite muito curto')
    .max(20, 'Código de convite muito longo')
    .transform((v) => v.toUpperCase().trim()),
  name: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(200, 'Nome muito longo')
    .transform((v) => v.trim()),
  email: z
    .string()
    .email('Email inválido')
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(128, 'Senha muito longa'),
  // Optional: for academy_invite, the academy name and data
  academy_data: z
    .object({
      name: z.string().min(2).max(200),
      cnpj: z.string().max(20).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(20).optional(),
      address: z.string().max(500).optional(),
      plan_name: z.string().optional(),
      plan_value: z.number().positive().optional(),
      student_limit: z.number().int().positive().optional(),
    })
    .optional(),
  // For student and teacher
  phone: z.string().max(20).optional(),
  cref: z.string().max(50).optional(),
});

export const listInvitesSchema = z.object({
  type: z.enum(['academy_invite', 'teacher_invite', 'student_invite']).optional(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const revokeInviteSchema = z.object({
  id: z.string().uuid('ID do convite deve ser um UUID válido'),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type ValidateInviteInput = z.infer<typeof validateInviteSchema>;
export type RedeemInviteInput = z.infer<typeof redeemInviteSchema>;
export type ListInvitesInput = z.infer<typeof listInvitesSchema>;
