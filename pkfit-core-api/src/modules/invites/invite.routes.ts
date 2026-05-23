import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import {
  createInviteHandler,
  validateInviteHandler,
  redeemInviteHandler,
  listInvitesHandler,
  revokeInviteHandler,
} from './invite.controller.js';

/**
 * Register all invite-related routes.
 *
 * Public:
 *   POST /api/v1/invites/validate — Check if invite code is valid
 *   POST /api/v1/invites/redeem   — Consume invite and create account
 *
 * Authenticated:
 *   POST   /api/v1/invites     — Create invite (ADMIN_GLOBAL, ADMIN_ACADEMIA)
 *   GET    /api/v1/invites     — List invites (ADMIN_GLOBAL, ADMIN_ACADEMIA)
 *   DELETE /api/v1/invites/:id — Revoke invite (owner or ADMIN_GLOBAL)
 */
export async function inviteRoutes(app: FastifyInstance): Promise<void> {
  // ==========================================
  // PUBLIC ROUTES (no auth required)
  // ==========================================

  app.post('/validate', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    handler: validateInviteHandler,
  });

  app.post('/redeem', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    handler: redeemInviteHandler,
  });

  // ==========================================
  // AUTHENTICATED ROUTES
  // ==========================================

  app.post('/', {
    preHandler: [authMiddleware, requireRole('ADMIN_GLOBAL', 'ADMIN_ACADEMIA')],
    handler: createInviteHandler,
  });

  app.get('/', {
    preHandler: [authMiddleware, requireRole('ADMIN_GLOBAL', 'ADMIN_ACADEMIA')],
    handler: listInvitesHandler,
  });

  app.delete('/:id', {
    preHandler: [authMiddleware, requireRole('ADMIN_GLOBAL', 'ADMIN_ACADEMIA')],
    handler: revokeInviteHandler,
  });
}
