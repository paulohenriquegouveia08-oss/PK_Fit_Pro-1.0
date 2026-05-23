import type { FastifyInstance } from 'fastify';
import { checkEmailHandler, loginHandler, setPasswordHandler } from './auth.controller.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Public routes (Rate limited securely to prevent brute-forcing)
  
  app.post('/check-email', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
    handler: checkEmailHandler,
  });

  app.post('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
    handler: loginHandler,
  });

  app.post('/set-password', {
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' },
    },
    handler: setPasswordHandler,
  });
}
