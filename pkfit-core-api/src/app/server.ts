import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { loadEnv } from '../config/env.js';
import { registerErrorHandler } from '../middleware/error-handler.js';
import { inviteRoutes } from '../modules/invites/invite.routes.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { userRoutes } from '../modules/users/user.routes.js';
import { academyRoutes } from '../modules/academies/academy.routes.js';
import { planRoutes } from '../modules/plans/plan.routes.js';
import { globalPlanRoutes } from '../modules/globalPlans/globalPlan.routes.js';
import { billingRoutes } from '../modules/billing/billing.routes.js';
import { workoutRoutes } from '../modules/workouts/workout.routes.js';
import { accessRoutes } from '../modules/access/access.routes.js';

// Load and validate environment variables early
const env = loadEnv();

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  },
  trustProxy: true, // Important if behind Vercel/Nginx
});

// ==========================================
// PLUGINS
// ==========================================

// CORS
await app.register(cors, {
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Rate Limiting (global)
await app.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
  errorResponseBuilder: () => ({
    success: false,
    error: 'Muitas requisições. Tente novamente em alguns instantes.',
  }),
});

// Error Handler
registerErrorHandler(app);

// ==========================================
// ROUTES
// ==========================================

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Register API modules
app.register(authRoutes, { prefix: '/api/v1/auth' });
app.register(inviteRoutes, { prefix: '/api/v1/invites' });
app.register(userRoutes, { prefix: '/api/v1/users' });
app.register(academyRoutes, { prefix: '/api/v1/academies' });
app.register(planRoutes, { prefix: '/api/v1/plans' });
app.register(globalPlanRoutes, { prefix: '/api/v1/global-plans' });
app.register(billingRoutes, { prefix: '/api/v1/billing' });
app.register(workoutRoutes, { prefix: '/api/v1/workouts' });
app.register(accessRoutes, { prefix: '/api/v1/access' });

// ==========================================
// BOOTSTRAP
// ==========================================

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

// Start the server locally if not running on Vercel
if (!process.env.VERCEL) {
  start();
}

// Export the fastify instance for Vercel Serverless
export default app;
