import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole, requireAcademy } from '../../middleware/rbac.middleware.js';
import { createPaymentHandler, markPlanPaidHandler, markPlanUnpaidHandler } from './billing.controller.js';

export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);
  app.addHook('preHandler', requireAcademy());
  app.addHook('preHandler', requireRole('ADMIN_ACADEMIA', 'ADMIN_GLOBAL'));

  app.post('/payments', createPaymentHandler);
  app.post('/payments/paid', markPlanPaidHandler);
  app.post('/payments/unpaid', markPlanUnpaidHandler);
}
