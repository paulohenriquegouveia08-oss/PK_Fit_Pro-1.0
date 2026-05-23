import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getEnv } from '../config/env.js';
import { getSupabaseAdmin } from '../infra/database/supabase-admin.js';
import type { AuthenticatedUser, UserRole } from '../types/common.types.js';

/**
 * Auth middleware — verifies the Supabase JWT token from the Authorization header.
 * Injects `request.currentUser` with { id, email, role, academy_id }.
 *
 * The JWT is verified using the SUPABASE_JWT_SECRET (HS256).
 * After verification, we fetch the user's role and academy from public.users + academy_users.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: 'Token de autenticação não fornecido',
    });
  }

  const token = authHeader.substring(7);

  try {
    const env = getEnv();
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

    // Verify the JWT with HS256
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    const userId = payload.sub;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: 'Token inválido: sem identificação de usuário',
      });
    }

    // Fetch user role and academy from database
    const supabase = getSupabaseAdmin();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return reply.status(401).send({
        success: false,
        error: 'Usuário não encontrado',
      });
    }

    if (!user.is_active) {
      return reply.status(403).send({
        success: false,
        error: 'Conta desativada. Entre em contato com o suporte.',
      });
    }

    // Fetch academy_id
    let academyId: string | null = null;
    const { data: academyUser } = await supabase
      .from('academy_users')
      .select('academy_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (academyUser) {
      academyId = academyUser.academy_id;
    }

    // Inject authenticated user into request
    request.currentUser = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      academy_id: academyId,
    };
  } catch (err: any) {
    if (err?.code === 'ERR_JWT_EXPIRED') {
      return reply.status(401).send({
        success: false,
        error: 'Token expirado. Faça login novamente.',
      });
    }

    request.log.error({ err }, 'JWT verification failed');
    return reply.status(401).send({
      success: false,
      error: 'Token inválido',
    });
  }
}

/**
 * Optional auth — same as authMiddleware but doesn't reject unauthenticated requests.
 * Used for public endpoints that behave differently for logged-in users.
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return;

  try {
    const env = getEnv();
    const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });

    const userId = payload.sub;
    if (!userId) return;

    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .single();

    if (!user || !user.is_active) return;

    const { data: academyUser } = await supabase
      .from('academy_users')
      .select('academy_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    request.currentUser = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      academy_id: academyUser?.academy_id || null,
    };
  } catch {
    // Silently fail — user simply won't be authenticated
  }
}
