import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPlanSchema, updatePlanSchema, deletePlanSchema, createStudentPlanSchema } from './plan.schema.js';
import { createPlan, updatePlan, deletePlan, createStudentPlan } from './plan.service.js';
import { audit } from '../audit/audit.service.js';

export async function createPlanHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = createPlanSchema.parse(request.body);
  const result = await createPlan(input, request.currentUser!);

  await audit(request, 'plan.create', { targetType: 'plan', targetId: result.id });
  reply.status(201).send({ success: true, data: result });
}

export async function updatePlanHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as any;
  const input = updatePlanSchema.parse({ ...request.body as any, id: params.id });
  
  const result = await updatePlan(input, request.currentUser!);
  
  await audit(request, 'plan.update', { targetType: 'plan', targetId: result.id });
  reply.status(200).send({ success: true, data: result });
}

export async function deletePlanHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = deletePlanSchema.parse(request.params);
  
  await deletePlan(input, request.currentUser!);
  
  await audit(request, 'plan.delete', { targetType: 'plan', targetId: input.id });
  reply.status(200).send({ success: true, message: 'Plano excluído com sucesso' });
}

export async function createStudentPlanHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = createStudentPlanSchema.parse(request.body);
  const result = await createStudentPlan(input, request.currentUser!);

  await audit(request, 'plan.assign_student', { 
    targetType: 'user', 
    targetId: input.student_id,
    metadata: { plan_id: input.plan_id } 
  });
  
  reply.status(201).send({ success: true, data: result });
}
