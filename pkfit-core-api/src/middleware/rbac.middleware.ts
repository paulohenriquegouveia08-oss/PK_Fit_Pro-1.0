import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '../types/common.types.js';

/**
 * Factory function that creates a Fastify preHandler for role-based access control.
 *
 * Usage:
 *   { preHandler: [authMiddleware, requireRole('ADMIN_GLOBAL', 'ADMIN_ACADEMIA')] }
 *
 * The user MUST have one of the specified roles, otherwise 403 is returned.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async function rbacMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.currentUser;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Autenticação necessária',
      });
    }

    if (!allowedRoles.includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: `Acesso negado. Roles permitidas: ${allowedRoles.join(', ')}`,
      });
    }
  };
}

/**
 * Ensures the authenticated user belongs to a specific academy.
 * Used for endpoints that require multi-tenant isolation.
 *
 * ADMIN_GLOBAL bypasses this check (they can access any academy).
 */
export function requireAcademy() {
  return async function tenantMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.currentUser;

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Autenticação necessária',
      });
    }

    // Admin Global can access any academy
    if (user.role === 'ADMIN_GLOBAL') return;

    if (!user.academy_id) {
      return reply.status(403).send({
        success: false,
        error: 'Usuário não vinculado a nenhuma academia',
      });
    }
  };
}
