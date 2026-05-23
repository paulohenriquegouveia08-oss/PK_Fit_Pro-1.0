import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

/**
 * Global error handler — catches all unhandled errors and formats them
 * into a consistent API response shape.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500;

    // Zod validation errors
    if (error.cause instanceof ZodError) {
      const issues = error.cause.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return reply.status(400).send({
        success: false,
        error: 'Dados inválidos',
        details: issues,
      });
    }

    // Rate limit errors
    if (statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: 'Muitas requisições. Tente novamente em alguns instantes.',
      });
    }

    // Log server errors
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Internal server error');
    }

    // Don't leak internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';
    const message = statusCode >= 500 && isProduction
      ? 'Erro interno do servidor'
      : error.message;

    return reply.status(statusCode).send({
      success: false,
      error: message,
    });
  });

  // Handle 404
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      success: false,
      error: 'Rota não encontrada',
    });
  });
}
