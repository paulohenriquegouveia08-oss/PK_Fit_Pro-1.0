import type { FastifyRequest, FastifyReply } from 'fastify';
import { createAcademySchema, deleteAcademySchema } from './academy.schema.js';
import { createAcademyLegacy, deleteAcademy } from './academy.service.js';
import { audit } from '../audit/audit.service.js';

export async function createAcademyHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = createAcademySchema.parse(request.body);

  const result = await createAcademyLegacy(input);

  await audit(request, 'academy.create_legacy', {
    targetType: 'academy',
    targetId: result.academy_id,
    metadata: { admin_email: input.admin_email, plan: input.plan_name },
  });

  reply.status(201).send({
    success: true,
    data: result,
  });
}

export async function deleteAcademyHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = deleteAcademySchema.parse(request.params);

  await deleteAcademy(input);

  await audit(request, 'academy.delete', {
    targetType: 'academy',
    targetId: input.id,
  });

  reply.status(200).send({
    success: true,
    message: 'Academia removida com sucesso',
  });
}
