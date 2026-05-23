import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validateAccessHandler, createAccessLogHandler, getLastPresenceHandler } from './access.controller.js';

export async function accessRoutes(app: FastifyInstance): Promise<void> {
  // Routes used by Turnstiles / Local Agents (API Key or specific service auth should ideally be here)
  // For now, if the frontend is proxying it, it will pass normal auth
  
  // Public-ish validation route that agent could call
  app.post('/validate', validateAccessHandler);
  app.post('/logs', createAccessLogHandler);

  // Protected route for the student app
  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', authMiddleware);
    protectedApp.get('/last-presence', getLastPresenceHandler);
  });
}
