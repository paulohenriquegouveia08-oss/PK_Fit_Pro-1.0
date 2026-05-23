import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import { insertAcademy, removeAcademyFully } from './academy.repository.js';
import { linkUserToAcademy, removeUserFully } from '../users/user.repository.js';
import type { CreateAcademyInput, DeleteAcademyInput } from './academy.schema.js';

export async function createAcademyLegacy(input: CreateAcademyInput) {
  const supabase = getSupabaseAdmin();

  // 1. Check if email exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', input.admin_email)
    .maybeSingle();

  if (existingUser) {
    throw new Error('Este email já está cadastrado');
  }

  // 2. Create admin user with Mud@r123
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.admin_email,
    password: 'Mud@r123',
    email_confirm: true,
    user_metadata: {
      name: input.admin_name,
      role: 'ADMIN_ACADEMIA',
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Erro ao criar conta de admin: ${authError?.message}`);
  }

  const userId = authData.user.id;

  try {
    // 3. Wait for trigger
    await new Promise((resolve) => setTimeout(resolve, 500));
    await supabase.from('users').update({ role: 'ADMIN_ACADEMIA', name: input.admin_name }).eq('id', userId);

    // 4. Create academy
    const academyId = await insertAcademy({
      name: input.name,
      email: input.admin_email,
      phone: input.phone,
      plan_name: input.plan_name,
      plan_value: input.plan_value,
    });

    // 5. Link user to academy
    await linkUserToAcademy(userId, academyId);

    return { academy_id: academyId, admin_id: userId };
  } catch (err) {
    await removeUserFully(userId).catch(console.error);
    throw err;
  }
}

export async function deleteAcademy(input: DeleteAcademyInput) {
  await removeAcademyFully(input.id);
}
