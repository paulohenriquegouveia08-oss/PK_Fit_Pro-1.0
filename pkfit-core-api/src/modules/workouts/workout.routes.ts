import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { createWorkoutHandler, updateWorkoutHandler, deleteWorkoutHandler } from './workout.controller.js';

export async function workoutRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);
  
  // Apenas professores e admins podem gerenciar treinos
  app.addHook('preHandler', requireRole('PROFESSOR', 'ADMIN_ACADEMIA', 'ADMIN_GLOBAL'));

  app.post('/', createWorkoutHandler);
  app.put('/:id', updateWorkoutHandler);
  app.delete('/:id', deleteWorkoutHandler);
}
