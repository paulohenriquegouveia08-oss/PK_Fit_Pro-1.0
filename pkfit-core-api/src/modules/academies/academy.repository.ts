import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';

const supabase = () => getSupabaseAdmin();

export async function insertAcademy(data: { name: string; plan_name: string; plan_value: number; phone?: string; email: string }) {
  const { data: academy, error } = await supabase()
    .from('academies')
    .insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      plan_name: data.plan_name,
      plan_value: data.plan_value,
      status: 'ACTIVE',
      payment_status: 'PENDING',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Erro ao criar academia: ${error.message}`);
  return academy.id;
}

export async function removeAcademyFully(academyId: string) {
  // To fully remove an academy, we must also remove its users from auth.users.
  // Because if we only delete the academy, auth.users won't be deleted automatically
  // unless we cascade from academy_users up (which PostgreSQL doesn't do natively).
  
  // 1. Get all users linked to this academy
  const { data: users } = await supabase()
    .from('academy_users')
    .select('user_id')
    .eq('academy_id', academyId);

  // 2. Delete all users from auth.users (cascades down)
  if (users && users.length > 0) {
    for (const u of users) {
      // Admin global shouldn't be deleted if they just happen to be linked, 
      // but usually an academy only has its own admins/teachers/students.
      const { data: userRole } = await supabase().from('users').select('role').eq('id', u.user_id).single();
      if (userRole?.role !== 'ADMIN_GLOBAL') {
        await supabase().auth.admin.deleteUser(u.user_id);
      }
    }
  }

  // 3. Delete academy
  const { error } = await supabase()
    .from('academies')
    .delete()
    .eq('id', academyId);

  if (error) throw new Error(`Erro ao deletar academia: ${error.message}`);
}
