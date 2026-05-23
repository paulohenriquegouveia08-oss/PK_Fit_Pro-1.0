import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole, requireAcademy } from '../../middleware/rbac.middleware.js';
import { createPlanHandler, updatePlanHandler, deletePlanHandler, createStudentPlanHandler } from './plan.controller.js';

export async function planRoutes(app: FastifyInstance): Promise<void> {
  // Common middleware for all routes here
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireAcademy());
  app.addHook('preHandler', requireRole('ADMIN_ACADEMIA', 'ADMIN_GLOBAL'));

  app.post('/', createPlanHandler);
  app.put('/:id', updatePlanHandler);
  app.delete('/:id', deletePlanHandler);
  
  // Link student to plan
  app.post('/student', createStudentPlanHandler);
}
