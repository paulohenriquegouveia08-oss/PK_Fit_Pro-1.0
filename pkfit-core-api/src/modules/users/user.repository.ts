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
  const adminClient = supabase();
  
  // Manual cascade cleanup to prevent 'Database error deleting user' due to missing foreign key constraints
  try {
    // 1. Unlink from invite_codes (used_by)
    await adminClient.from('invite_codes').update({ used_by: null }).eq('used_by', userId);
    
    // 2. Delete relations in public tables
    await adminClient.from('professor_students').delete().eq('student_id', userId);
    await adminClient.from('professor_students').delete().eq('professor_id', userId);
    await adminClient.from('student_plans').delete().eq('student_id', userId);
    await adminClient.from('academy_users').delete().eq('user_id', userId);
    await adminClient.from('workouts').delete().eq('student_id', userId);
    
    // 3. Delete from public.users
    await adminClient.from('users').delete().eq('id', userId);
  } catch (cleanupError) {
    console.warn('[DELETE_USER] Error during manual cleanup:', cleanupError);
    // Continue anyway to try and delete the auth user
  }

  // 4. Delete the auth.users record.
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Database error deleting user: ${error.message}`);
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
