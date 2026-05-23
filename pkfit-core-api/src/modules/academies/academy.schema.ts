import { z } from 'zod';

export const createAcademySchema = z.object({
  name: z.string().min(2, 'Nome da academia deve ter no mínimo 2 caracteres').max(200),
  admin_name: z.string().min(2, 'Nome do administrador deve ter no mínimo 2 caracteres').max(200),
  admin_email: z.string().email('Email inválido').transform(v => v.toLowerCase().trim()),
  plan_name: z.string().optional().default('Básico'),
  plan_value: z.number().nonnegative().optional().default(0),
  phone: z.string().max(20).optional(),
});

export const deleteAcademySchema = z.object({
  id: z.string().uuid('ID de academia inválido'),
});

export type CreateAcademyInput = z.infer<typeof createAcademySchema>;
export type DeleteAcademyInput = z.infer<typeof deleteAcademySchema>;
