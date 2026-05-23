import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkEmailSchema, loginSchema, setPasswordSchema } from './auth.schema.js';
import { checkEmail, login, setPassword } from './auth.service.js';
import { audit } from '../audit/audit.service.js';

export async function checkEmailHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = checkEmailSchema.parse(request.body);
  const result = await checkEmail(input);

  reply.status(200).send({
    success: true,
    data: result,
  });
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = loginSchema.parse(request.body);
  const result = await login(input);

  // Log successful login
  await audit(request, 'auth.login', {
    targetType: 'user',
    targetId: result.user.id,
    academyId: result.user.academy_id || undefined,
    metadata: { role: result.user.role },
  });

  reply.status(200).send({
    success: true,
    data: result,
  });
}

export async function setPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = setPasswordSchema.parse(request.body);
  const result = await setPassword(input);

  reply.status(200).send({
    success: true,
    message: 'Senha configurada com sucesso',
  });
}
