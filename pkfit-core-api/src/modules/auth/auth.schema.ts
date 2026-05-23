import { z } from 'zod';

export const checkEmailSchema = z.object({
  email: z.string().email('Email inválido').transform(v => v.toLowerCase().trim()),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido').transform(v => v.toLowerCase().trim()),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const setPasswordSchema = z.object({
  email: z.string().email('Email inválido').transform(v => v.toLowerCase().trim()),
  new_password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(128, 'Senha muito longa'),
});

export type CheckEmailInput = z.infer<typeof checkEmailSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
