import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Authenticated user injected by auth middleware */
    currentUser?: import('./common.types.js').AuthenticatedUser;
  }
}
