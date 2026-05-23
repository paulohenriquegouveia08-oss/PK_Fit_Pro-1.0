import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateAccessSchema, createAccessLogSchema } from './access.schema.js';
import { validateAccess, createAccessLog, getLastPresence } from './access.service.js';

export async function validateAccessHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = validateAccessSchema.parse(request.body);
  const result = await validateAccess(input);
  
  reply.status(200).send({ success: true, data: result });
}

export async function createAccessLogHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = createAccessLogSchema.parse(request.body);
  const result = await createAccessLog(input);

  reply.status(201).send({ success: true, data: result });
}

export async function getLastPresenceHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await getLastPresence(request.currentUser!.id, request.currentUser!.academy_id!);
  reply.status(200).send({ success: true, data: result });
}
