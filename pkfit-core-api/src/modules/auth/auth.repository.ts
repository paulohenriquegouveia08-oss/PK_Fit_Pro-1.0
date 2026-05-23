import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import type { UserRole } from '../../types/common.types.js';

export interface UserAuthRecord {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  academy_id: string | null;
}

const supabase = () => getSupabaseAdmin();

/**
 * Checks if a user exists by email and gets their basic info.
 */
export async function findUserByEmail(email: string): Promise<UserAuthRecord | null> {
  const { data, error } = await supabase()
    .from('users')
    .select('id, email, role, is_active')
    .eq('email', email)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw new Error(`Erro ao buscar usuário: ${error.message}`);

  // Fetch academy link if exists
  const { data: academyLink } = await supabase()
    .from('academy_users')
    .select('academy_id')
    .eq('user_id', data.id)
    .limit(1)
    .maybeSingle();

  return {
    ...data,
    role: data.role as UserRole,
    academy_id: academyLink?.academy_id || null,
  };
}

/**
 * Checks if a user has unpaid plans (blocks access).
 * Only applies to ALUNO role.
 */
export async function hasUnpaidPlans(userId: string): Promise<boolean> {
  const { data, error } = await supabase()
    .from('student_plans')
    .select('id')
    .eq('student_id', userId)
    .eq('status', 'ACTIVE')
    .eq('payment_status', 'LATE')
    .limit(1);

  if (error) {
    console.error('Error checking unpaid plans:', error);
    return false; // Fail open or closed? If DB errors, we don't want to block everyone, so fail open but log.
  }

  return data && data.length > 0;
}
