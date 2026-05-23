import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import type { UserRole } from '../../types/common.types.js';

const supabase = () => getSupabaseAdmin();

export async function linkUserToAcademy(userId: string, academyId: string) {
  const { error } = await supabase()
    .from('academy_users')
    .insert({ user_id: userId, academy_id: academyId });

  if (error) throw new Error(`Erro ao vincular à academia: ${error.message}`);
}

export async function linkStudentToProfessor(studentId: string, professorId: string) {
  const { error } = await supabase()
    .from('professor_students')
    .insert({ student_id: studentId, professor_id: professorId });

  if (error) throw new Error(`Erro ao vincular ao professor: ${error.message}`);
}

export async function removeUserFully(userId: string) {
  // We use Supabase Admin SDK to delete the auth.users record.
  // Because of ON DELETE CASCADE, this should cascade to public.users,
  // academy_users, professor_students, etc.
  const { error } = await supabase().auth.admin.deleteUser(userId);
  if (error) throw new Error(`Erro ao deletar conta de autenticação: ${error.message}`);
}

export async function findUserAcademy(userId: string): Promise<string | null> {
    const { data } = await supabase()
      .from('academy_users')
      .select('academy_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
      
    return data?.academy_id || null;
}
