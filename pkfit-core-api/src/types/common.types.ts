// ================================================
// Common types used across the Core API
// ================================================

export type UserRole = 'ADMIN_GLOBAL' | 'ADMIN_ACADEMIA' | 'PROFESSOR' | 'ALUNO';

export type InviteType = 'academy_invite' | 'teacher_invite' | 'student_invite';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  academy_id: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditEntry {
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  academy_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
}

// ================================================
// Invite Code Expiration Config
// ================================================

export const INVITE_EXPIRATION_HOURS: Record<InviteType, number> = {
  academy_invite: 24,      // 24 horas
  teacher_invite: 12,      // 12 horas
  student_invite: 0.5,     // 30 minutos
};

export const INVITE_CODE_PREFIXES: Record<InviteType, string> = {
  academy_invite: 'PK-ACA',
  teacher_invite: 'PK-PRF',
  student_invite: 'PK-ALN',
};
