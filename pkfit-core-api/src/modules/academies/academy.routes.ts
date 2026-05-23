import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { createAcademyHandler, deleteAcademyHandler } from './academy.controller.js';

export async function academyRoutes(app: FastifyInstance): Promise<void> {
  // Only Global Admins can manage academies in legacy mode
  app.post('/', {
    preHandler: [authMiddleware, requireRole('ADMIN_GLOBAL')],
    handler: createAcademyHandler,
  });

  app.delete('/:id', {
    preHandler: [authMiddleware, requireRole('ADMIN_GLOBAL')],
    handler: deleteAcademyHandler,
  });
}
