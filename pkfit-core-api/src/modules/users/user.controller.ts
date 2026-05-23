import type { FastifyRequest, FastifyReply } from 'fastify';
import { createUserSchema, deleteUserSchema } from './user.schema.js';
import { createUser, deleteUser } from './user.service.js';
import { audit } from '../audit/audit.service.js';

export async function createUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = createUserSchema.parse(request.body);
  const actor = request.currentUser!;

  const result = await createUser(input, actor);

  await audit(request, 'user.create', {
    targetType: 'user',
    targetId: result.id,
    metadata: { role: input.role, email: input.email },
  });

  reply.status(201).send({
    success: true,
    data: result,
  });
}

export async function deleteUserHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = deleteUserSchema.parse(request.params);
  const actor = request.currentUser!;

  await deleteUser(input, actor);

  await audit(request, 'user.delete', {
    targetType: 'user',
    targetId: input.id,
  });

  reply.status(200).send({
    success: true,
    message: 'Usuário removido com sucesso',
  });
}
