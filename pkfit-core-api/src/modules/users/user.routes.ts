import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole, requireAcademy } from '../../middleware/rbac.middleware.js';
import { createUserHandler, deleteUserHandler } from './user.controller.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // Members can only be created by ADMIN_GLOBAL or ADMIN_ACADEMIA
  app.post('/', {
    preHandler: [
      authMiddleware, 
      requireRole('ADMIN_GLOBAL', 'ADMIN_ACADEMIA'),
      requireAcademy()
    ],
    handler: createUserHandler,
  });

  app.delete('/:id', {
    preHandler: [
      authMiddleware, 
      requireRole('ADMIN_GLOBAL', 'ADMIN_ACADEMIA'),
      requireAcademy()
    ],
    handler: deleteUserHandler,
  });
}
