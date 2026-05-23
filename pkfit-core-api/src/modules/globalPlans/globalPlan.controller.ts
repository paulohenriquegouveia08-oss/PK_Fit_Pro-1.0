import type { FastifyRequest, FastifyReply } from 'fastify';
import { globalPlanService } from './globalPlan.service.js';
import { createGlobalPlanSchema, updateGlobalPlanSchema } from './globalPlan.schema.js';

export async function getGlobalPlansHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const userRole = req.currentUser?.role;
    // Admins see all plans (including inactive). Public / others see only active.
    const includeInactive = userRole === 'ADMIN_GLOBAL';
    const plans = await globalPlanService.getAllPlans(includeInactive);
    return reply.status(200).send({ success: true, data: plans });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(400).send({ success: false, error: error.message });
  }
}

export async function createGlobalPlanHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    const input = createGlobalPlanSchema.parse(req.body);
    const plan = await globalPlanService.createPlan(input);
    return reply.status(201).send({ success: true, data: plan });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(400).send({ success: false, error: error.message });
  }
}

export async function updateGlobalPlanHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    const { id } = req.params;
    const input = updateGlobalPlanSchema.parse(req.body);
    const plan = await globalPlanService.updatePlan(id, input);
    return reply.status(200).send({ success: true, data: plan });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(400).send({ success: false, error: error.message });
  }
}

export async function deleteGlobalPlanHandler(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    const { id } = req.params;
    await globalPlanService.deletePlan(id);
    return reply.status(200).send({ success: true, message: 'Plano deletado com sucesso' });
  } catch (error: any) {
    req.log.error(error);
    return reply.status(400).send({ success: false, error: error.message });
  }
}
