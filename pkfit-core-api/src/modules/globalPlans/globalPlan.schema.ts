import { z } from 'zod';

export const createGlobalPlanSchema = z.object({
  name: z.string().min(2).max(100),
  price: z.number().min(0),
  student_limit: z.number().int().min(0),
  features: z.record(z.any()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

export const updateGlobalPlanSchema = createGlobalPlanSchema.partial();

export type CreateGlobalPlanInput = z.infer<typeof createGlobalPlanSchema>;
export type UpdateGlobalPlanInput = z.infer<typeof updateGlobalPlanSchema>;
