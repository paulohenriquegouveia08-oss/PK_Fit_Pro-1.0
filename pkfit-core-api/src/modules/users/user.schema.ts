import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(200, 'Nome muito longo'),
  email: z.string().email('Email inválido').transform(v => v.toLowerCase().trim()),
  role: z.enum(['PROFESSOR', 'ALUNO'], {
    required_error: 'Função (role) é obrigatória',
  }),
  // If role === ALUNO, a professor_id can be provided
  professor_id: z.string().uuid().optional(),
});

export const deleteUserSchema = z.object({
  id: z.string().uuid('ID de usuário inválido'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
