import { z } from 'zod';

export const exerciseSchema = z.object({
  name: z.string().min(1, 'Nome do exercício obrigatório'),
  sets: z.number().positive('Séries devem ser maiores que zero'),
  reps: z.string().min(1, 'Repetições obrigatórias'),
  rest: z.number().nonnegative('Descanso não pode ser negativo'),
  load: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const workoutDaySchema = z.object({
  day_label: z.string().min(1, 'Label do dia obrigatório'),
  day_name: z.string().min(1, 'Nome do dia obrigatório'),
  exercises: z.array(exerciseSchema),
});

export const createWorkoutSchema = z.object({
  student_id: z.string().uuid('ID de aluno inválido'),
  professor_id: z.string().uuid('ID de professor inválido'),
  days: z.array(workoutDaySchema),
});

export const updateWorkoutSchema = z.object({
  days: z.array(workoutDaySchema),
  student_id: z.string().uuid().optional(),
  professor_id: z.string().uuid().optional(),
}).extend({
  id: z.string().uuid('ID inválido'),
});

export const deleteWorkoutSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;
export type DeleteWorkoutInput = z.infer<typeof deleteWorkoutSchema>;
