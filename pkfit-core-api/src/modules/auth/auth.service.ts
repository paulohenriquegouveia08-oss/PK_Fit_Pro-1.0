import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import { findUserByEmail, hasUnpaidPlans } from './auth.repository.js';
import type { CheckEmailInput, LoginInput, SetPasswordInput } from './auth.schema.js';

export async function checkEmail(input: CheckEmailInput) {
  const user = await findUserByEmail(input.email);

  if (!user) {
    return { exists: false };
  }

  let needsPasswordSetup = false;
  // If active, test if they are using the default migration password
  if (user.is_active) {
    const supabase = getSupabaseAdmin();
    const { error: tempLoginError } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: 'Mud@r123'
    });
    if (!tempLoginError) {
      needsPasswordSetup = true;
    }
  }

  return {
    exists: true,
    role: user.role,
    is_active: user.is_active,
    needsPasswordSetup,
  };
}

export async function login(input: LoginInput) {
  // 1. Authenticate with Supabase
  // We use the REST API via supabase-js (client mode, not admin mode for login)
  // because we need the actual user session JWT.
  const supabase = getSupabaseAdmin();
  
  // Actually, we can use the admin client's auth.signInWithPassword because it
  // returns the session data (access_token, etc). However, we must be careful 
  // not to persist it on the server. The admin client is configured with persistSession: false.
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (authError || !authData.session) {
    if (input.password === 'Mud@r123') {
       // It failed even with Mud@r123, so standard invalid credentials
       throw new Error('Credenciais inválidas');
    }
    throw new Error('Credenciais inválidas');
  }

  // 2. Business Logic Checks
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new Error('Usuário não encontrado no sistema principal');
  }

  if (!user.is_active) {
    throw new Error('Sua conta está desativada. Entre em contato com a administração.');
  }

  // Se o usuário for ALUNO, verificar inadimplência
  if (user.role === 'ALUNO') {
    const isLate = await hasUnpaidPlans(user.id);
    if (isLate) {
      throw new Error('Acesso bloqueado. Verifique pendências no seu plano ou contate a recepção.');
    }
  }

  // Se a senha informada foi a temporária "Mud@r123", nós alertamos o frontend
  // para forçar a tela de troca de senha.
  const needsPasswordSetup = input.password === 'Mud@r123';

  return {
    session: authData.session,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      academy_id: user.academy_id,
    },
    needsPasswordSetup,
  };
}

export async function setPassword(input: SetPasswordInput) {
  const supabase = getSupabaseAdmin();

  // 1. Verify if the user can login with Mud@r123 (ensures they are in the setup phase)
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: 'Mud@r123',
  });

  if (authError || !authData.user) {
    throw new Error('Não foi possível alterar a senha. A conta não está em fase de configuração inicial ou o email é inválido.');
  }

  // 2. Change password using Admin SDK
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    authData.user.id,
    { password: input.new_password }
  );

  if (updateError) {
    throw new Error(`Erro ao atualizar senha: ${updateError.message}`);
  }

  return { success: true };
}
