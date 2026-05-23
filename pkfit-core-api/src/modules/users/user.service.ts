import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import { linkUserToAcademy, linkStudentToProfessor, removeUserFully, findUserAcademy } from './user.repository.js';
import type { CreateUserInput, DeleteUserInput } from './user.schema.js';
import type { AuthenticatedUser } from '../../types/common.types.js';

export async function createUser(input: CreateUserInput, actor: AuthenticatedUser) {
  const supabase = getSupabaseAdmin();

  if (!actor.academy_id && actor.role !== 'ADMIN_GLOBAL') {
    throw new Error('Administrador sem vínculo com academia');
  }
  
  // Use actor's academy, or if global admin, this would need a parameter (we assume actor's academy for now
  // since the frontend only sends name, email, role, and professor_id)
  const academyId = actor.academy_id!;

  // 1. Check if email already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();

  if (existingUser) {
    throw new Error('Este email já está cadastrado');
  }

  // 2. Create Auth User with Mud@r123
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: 'Mud@r123',
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role: input.role,
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Erro ao criar conta: ${authError?.message}`);
  }

  const userId = authData.user.id;

  try {
    // 3. Wait for the trigger `on_auth_user_created` to fire
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Force role update in case trigger used metadata weirdly
    await supabase.from('users').update({ role: input.role, name: input.name }).eq('id', userId);

    // 4. Link to Academy
    await linkUserToAcademy(userId, academyId);

    // 5. Link to Professor if it's a student and professor is provided
    if (input.role === 'ALUNO' && input.professor_id) {
      // Validate professor belongs to the same academy
      const profAcademy = await findUserAcademy(input.professor_id);
      if (profAcademy !== academyId) {
        throw new Error('Professor não pertence à mesma academia');
      }
      await linkStudentToProfessor(userId, input.professor_id);
    }

    return { id: userId, email: input.email, role: input.role };
  } catch (err) {
    // Rollback
    await removeUserFully(userId).catch(console.error);
    throw err;
  }
}

export async function deleteUser(input: DeleteUserInput, actor: AuthenticatedUser) {
  // 1. Check if target user belongs to actor's academy
  const targetAcademy = await findUserAcademy(input.id);
  
  if (actor.role !== 'ADMIN_GLOBAL') {
    if (!targetAcademy || targetAcademy !== actor.academy_id) {
      throw new Error('Permissão negada. Usuário não pertence à sua academia.');
    }
  }

  // 2. We don't allow deleting admins through this endpoint to prevent locking out
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from('users').select('role').eq('id', input.id).single();
  
  if (user?.role === 'ADMIN_GLOBAL' || user?.role === 'ADMIN_ACADEMIA') {
    throw new Error('Não é possível deletar administradores por esta rota');
  }

  // 3. Delete from auth.users (cascades to public.users and links)
  await removeUserFully(input.id);
}
