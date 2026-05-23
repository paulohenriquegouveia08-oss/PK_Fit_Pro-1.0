import type { FastifyInstance } from 'fastify';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { 
  getGlobalPlansHandler, 
  createGlobalPlanHandler, 
  updateGlobalPlanHandler, 
  deleteGlobalPlanHandler 
} from './globalPlan.controller.js';

export async function globalPlanRoutes(app: FastifyInstance): Promise<void> {
  // Public (or optional auth) route to get plans so frontend can show them in invite modal or public pages
  app.get('/', { preHandler: optionalAuthMiddleware }, getGlobalPlansHandler);

  // Admin Global only routes
  app.register(async function (adminRoutes) {
    adminRoutes.addHook('preHandler', authMiddleware);
    adminRoutes.addHook('preHandler', requireRole('ADMIN_GLOBAL'));

    adminRoutes.post('/', createGlobalPlanHandler);
    adminRoutes.put('/:id', updateGlobalPlanHandler);
    adminRoutes.delete('/:id', deleteGlobalPlanHandler);
  });
}
