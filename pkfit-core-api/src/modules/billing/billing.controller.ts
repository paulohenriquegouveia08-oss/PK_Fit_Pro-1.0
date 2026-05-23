import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPaymentSchema, markPlanPaidSchema, markPlanUnpaidSchema } from './billing.schema.js';
import { createPayment, markStudentPlanAsPaid, markStudentPlanAsUnpaid } from './billing.service.js';
import { audit } from '../audit/audit.service.js';

export async function createPaymentHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = createPaymentSchema.parse(request.body);
  const result = await createPayment(input, request.currentUser!);

  await audit(request, 'billing.create_payment', { targetType: 'payment', targetId: result.id });
  reply.status(201).send({ success: true, data: result });
}

export async function markPlanPaidHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = markPlanPaidSchema.parse(request.body);
  const result = await markStudentPlanAsPaid(input, request.currentUser!);

  await audit(request, 'billing.mark_paid', { 
    targetType: 'user', 
    targetId: input.student_id,
    metadata: { plan_id: input.plan_id, payment_id: result.id } 
  });
  
  reply.status(201).send({ success: true, data: result });
}

export async function markPlanUnpaidHandler(request: FastifyRequest, reply: FastifyReply) {
  const input = markPlanUnpaidSchema.parse(request.body);
  await markStudentPlanAsUnpaid(input, request.currentUser!);

  await audit(request, 'billing.mark_unpaid', { 
    targetType: 'user', 
    targetId: input.student_id,
    metadata: { plan_id: input.plan_id } 
  });
  
  reply.status(200).send({ success: true, message: 'Pagamento estornado com sucesso' });
}
