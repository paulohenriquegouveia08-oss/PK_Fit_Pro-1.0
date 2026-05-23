import type { FastifyRequest } from 'fastify';
import { createAuditLog } from './audit.repository.js';

/**
 * High-level audit service — extracts common info from the Fastify request
 * and delegates to the repository.
 */
export async function audit(
  request: FastifyRequest,
  action: string,
  opts: {
    targetType?: string;
    targetId?: string;
    academyId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const user = request.currentUser;

  await createAuditLog({
    actor_id: user?.id || null,
    actor_role: user?.role || null,
    action,
    target_type: opts.targetType || null,
    target_id: opts.targetId || null,
    academy_id: opts.academyId || user?.academy_id || null,
    metadata: opts.metadata || {},
    ip_address: request.ip || null,
    user_agent: request.headers['user-agent'] || null,
  });
}
