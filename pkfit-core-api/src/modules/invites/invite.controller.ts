import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createInviteSchema,
  validateInviteSchema,
  redeemInviteSchema,
  listInvitesSchema,
  revokeInviteSchema,
} from './invite.schema.js';
import {
  createInvite,
  validateInvite,
  redeemInvite,
  getInviteList,
  revokeInviteById,
} from './invite.service.js';
import { audit } from '../audit/audit.service.js';

// ==========================================
// POST /api/v1/invites — Create Invite
// ==========================================

export async function createInviteHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const input = createInviteSchema.parse(request.body);
  const user = request.currentUser!;

  const result = await createInvite(input, user);

  // Audit log
  await audit(request, 'invite.create', {
    targetType: 'invite',
    targetId: result.id,
    academyId: input.academy_id || undefined,
    metadata: {
      type: input.type,
      code: result.code,
      expires_at: result.expires_at,
      max_uses: result.max_uses,
    },
  });

  reply.status(201).send({
    success: true,
    data: result,
  });
}

// ==========================================
// POST /api/v1/invites/validate — Validate Invite (public)
// ==========================================

export async function validateInviteHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { code } = validateInviteSchema.parse(request.body);

  const result = await validateInvite(code);

  reply.status(200).send({
    success: true,
    data: result,
  });
}

// ==========================================
// POST /api/v1/invites/redeem — Redeem Invite (public)
// ==========================================

export async function redeemInviteHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const input = redeemInviteSchema.parse(request.body);

  const result = await redeemInvite(input);

  // Audit log (no currentUser — this is a public endpoint)
  await audit(request, 'invite.redeem', {
    targetType: 'invite',
    targetId: result.user_id,
    academyId: result.academy_id || undefined,
    metadata: {
      code: input.code,
      email: input.email,
      role: result.role,
    },
  });

  reply.status(201).send({
    success: true,
    data: result,
  });
}

// ==========================================
// GET /api/v1/invites — List Invites
// ==========================================

export async function listInvitesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const filters = listInvitesSchema.parse(request.query);
  const user = request.currentUser!;

  // Non-global admins can only see their academy's invites
  const academyId = user.role === 'ADMIN_GLOBAL' ? undefined : user.academy_id;

  const { invites, total } = await getInviteList({
    type: filters.type,
    active: filters.active,
    academy_id: academyId,
    page: filters.page,
    limit: filters.limit,
  });

  reply.status(200).send({
    success: true,
    data: invites,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  });
}

// ==========================================
// DELETE /api/v1/invites/:id — Revoke Invite
// ==========================================

export async function revokeInviteHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { id } = revokeInviteSchema.parse(request.params);
  const user = request.currentUser!;

  await revokeInviteById(id, user);

  // Audit log
  await audit(request, 'invite.revoke', {
    targetType: 'invite',
    targetId: id,
  });

  reply.status(200).send({
    success: true,
    message: 'Convite revogado com sucesso',
  });
}
