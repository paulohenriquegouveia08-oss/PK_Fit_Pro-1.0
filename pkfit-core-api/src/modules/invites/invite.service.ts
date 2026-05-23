import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import { generateInviteCode, isValidCodeFormat } from '../../utils/code-generator.js';
import {
  INVITE_EXPIRATION_HOURS,
  type InviteType,
  type AuthenticatedUser,
} from '../../types/common.types.js';
import {
  insertInvite,
  findActiveInviteByCode,
  consumeInviteUse,
  revokeInvite as revokeInviteRepo,
  listInvites as listInvitesRepo,
  findInviteById,
  type InviteRecord,
} from './invite.repository.js';
import type { CreateInviteInput, RedeemInviteInput } from './invite.schema.js';

// ==========================================
// CREATE INVITE
// ==========================================

export interface CreateInviteResult {
  id: string;
  code: string;
  type: InviteType;
  expires_at: string;
  max_uses: number;
  current_uses: number;
}

export async function createInvite(
  input: CreateInviteInput,
  actor: AuthenticatedUser
): Promise<CreateInviteResult> {
  // Validate permissions
  if (input.type === 'academy_invite' && actor.role !== 'ADMIN_GLOBAL') {
    throw new Error('Apenas administradores globais podem criar convites de academia');
  }

  if (
    (input.type === 'teacher_invite' || input.type === 'student_invite') &&
    !['ADMIN_GLOBAL', 'ADMIN_ACADEMIA'].includes(actor.role)
  ) {
    throw new Error('Apenas administradores podem criar convites de professor/aluno');
  }

  // For teacher/student invites, require academy_id
  const academyId =
    input.type === 'academy_invite'
      ? null
      : input.academy_id || actor.academy_id;

  if (input.type !== 'academy_invite' && !academyId) {
    throw new Error('academy_id é obrigatório para convites de professor/aluno');
  }

  // Generate unique code with retry
  let code: string;
  let attempts = 0;
  do {
    code = generateInviteCode(input.type);
    attempts++;
    if (attempts > 10) throw new Error('Falha ao gerar código único');

    const existing = await findActiveInviteByCode(code);
    if (!existing) break;
  } while (true);

  // Calculate expiration
  const expirationHours =
    input.custom_expiration_hours || INVITE_EXPIRATION_HOURS[input.type];
  const expiresAt = new Date(
    Date.now() + expirationHours * 60 * 60 * 1000
  ).toISOString();

  // Insert into database
  const invite = await insertInvite({
    code,
    type: input.type,
    academy_id: academyId,
    created_by: actor.id,
    expires_at: expiresAt,
    max_uses: input.max_uses,
    metadata: input.metadata || {},
  });

  return {
    id: invite.id,
    code: invite.code,
    type: invite.type,
    expires_at: invite.expires_at,
    max_uses: invite.max_uses,
    current_uses: invite.current_uses,
  };
}

// ==========================================
// VALIDATE INVITE (without consuming)
// ==========================================

export interface ValidateInviteResult {
  valid: boolean;
  type: InviteType | null;
  expires_at: string | null;
  remaining_uses: number;
  metadata: Record<string, unknown>;
  reason?: string;
}

export async function validateInvite(code: string): Promise<ValidateInviteResult> {
  if (!isValidCodeFormat(code)) {
    return {
      valid: false,
      type: null,
      expires_at: null,
      remaining_uses: 0,
      metadata: {},
      reason: 'Formato de código inválido',
    };
  }

  const invite = await findActiveInviteByCode(code);

  if (!invite) {
    return {
      valid: false,
      type: null,
      expires_at: null,
      remaining_uses: 0,
      metadata: {},
      reason: 'Código de convite inválido ou expirado',
    };
  }

  if (invite.current_uses >= invite.max_uses) {
    return {
      valid: false,
      type: invite.type,
      expires_at: invite.expires_at,
      remaining_uses: 0,
      metadata: {},
      reason: 'Convite já utilizado',
    };
  }

  return {
    valid: true,
    type: invite.type,
    expires_at: invite.expires_at,
    remaining_uses: invite.max_uses - invite.current_uses,
    metadata: invite.metadata,
  };
}

// ==========================================
// REDEEM INVITE (consume + create user + setup)
// ==========================================

export interface RedeemInviteResult {
  user_id: string;
  academy_id: string | null;
  role: string;
}

export async function redeemInvite(input: RedeemInviteInput): Promise<RedeemInviteResult> {
  const supabase = getSupabaseAdmin();

  // 1. Find and validate invite
  const invite = await findActiveInviteByCode(input.code);

  if (!invite) {
    throw new Error('Código de convite inválido ou expirado');
  }

  if (invite.current_uses >= invite.max_uses) {
    throw new Error('Convite já utilizado o número máximo de vezes');
  }

  // 2. Check if email already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();

  if (existingUser) {
    throw new Error('Este email já está cadastrado no sistema');
  }

  // 3. Determine role based on invite type
  const roleMap: Record<InviteType, string> = {
    academy_invite: 'ADMIN_ACADEMIA',
    teacher_invite: 'PROFESSOR',
    student_invite: 'ALUNO',
  };
  const role = roleMap[invite.type];

  // 4. Create auth user via Supabase Admin SDK
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role,
    },
  });

  if (authError) {
    throw new Error(`Erro ao criar conta: ${authError.message}`);
  }

  const userId = authData.user.id;

  try {
    // 5. Wait for trigger to create public.users record, then update role
    // The trigger on_auth_user_created creates the record, but we need to ensure
    // the role is correct (trigger uses metadata, but we enforce here)
    await new Promise((resolve) => setTimeout(resolve, 500));

    const updatePayload: any = { 
      role, 
      name: input.name,
      phone: input.phone || null,
      cpf: (input as any).cpf || null,
      cref: input.cref || null
    };

    if (role === 'ALUNO') {
      updatePayload.birth_date = (input as any).birth_date || null;
      // Get photo_url from invite metadata if present
      const photoUrl = (invite.metadata as any)?.photo_url;
      if (photoUrl) {
        updatePayload.photo_url = photoUrl;
      }
    }

    // Try updating with all fields
    const { error: updateError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId);

    if (updateError) {
      // If error is about missing column (e.g., photo_url, cpf, cref not migrated yet),
      // fallback to basic fields so the user creation doesn't fail completely with a 500.
      console.warn('[INVITE] Update failed (possibly missing columns in DB). Falling back to basic update.', updateError);
      await supabase
        .from('users')
        .update({ role, name: input.name, phone: input.phone || null })
        .eq('id', userId);
    }

    // 6. Handle academy creation or linking
    let academyId: string | null = null;

    if (invite.type === 'academy_invite') {
      // Create academy
      const academyData = input.academy_data || {
        name: `Academia de ${input.name}`,
      };

      const { data: academy, error: academyError } = await supabase
        .from('academies')
        .insert({
          name: academyData.name,
          cnpj: academyData.cnpj || null,
          email: academyData.email || input.email,
          phone: academyData.phone || null,
          address: academyData.address || null,
          plan_name: academyData.plan_name || (invite.metadata as any)?.plan_name || 'Básico',
          plan_value: academyData.plan_value || (invite.metadata as any)?.plan_value || 0,
          student_limit: academyData.student_limit || (invite.metadata as any)?.student_limit || 0,
          status: 'ACTIVE',
          payment_status: 'PENDING',
        })
        .select('id')
        .single();

      if (academyError) throw new Error(`Erro ao criar academia: ${academyError.message}`);
      academyId = academy.id;

      // Link user to academy
      await supabase.from('academy_users').insert({
        academy_id: academyId,
        user_id: userId,
      });
    } else {
      // teacher_invite or student_invite — link to existing academy
      academyId = invite.academy_id;

      if (!academyId) {
        throw new Error('Convite sem academia vinculada');
      }

      await supabase.from('academy_users').insert({
        academy_id: academyId,
        user_id: userId,
      });

      // For student invites, link to professor if specified in metadata
      if (invite.type === 'student_invite') {
        const metadata = invite.metadata as any;
        
        if (metadata?.professor_id) {
          await supabase.from('professor_students').insert({
            professor_id: metadata.professor_id,
            student_id: userId,
          });
        }

        // Assign plan if specified
        if (metadata?.plan_id) {
          // Fetch plan details to calculate end date and price
          const { data: plan } = await supabase
            .from('plans')
            .select('duration_in_months, price')
            .eq('id', metadata.plan_id)
            .single();

          if (plan) {
            const startDate = new Date();
            const endDate = new Date(startDate);
            
            if (plan.duration_in_months === -1) {
              endDate.setDate(startDate.getDate() + 1);
            } else if (plan.duration_in_months === 0) {
              endDate.setDate(startDate.getDate() + 7);
            } else {
              endDate.setMonth(startDate.getMonth() + plan.duration_in_months);
            }

            await supabase.from('student_plans').insert({
              student_id: userId,
              plan_id: metadata.plan_id,
              academy_id: academyId,
              plan_start_date: startDate.toISOString(),
              plan_end_date: endDate.toISOString(),
              is_active: true
            });
            
            // Register initial payment
            if (metadata.payment_status && metadata.payment_method) {
               await supabase.from('payments').insert({
                 academy_id: academyId,
                 student_id: userId,
                 plan_id: metadata.plan_id,
                 amount: plan.price || 0,
                 status: metadata.payment_status,
                 payment_method: metadata.payment_method,
                 payment_date: startDate.toISOString().split('T')[0],
                 description: 'Mensalidade inicial (Matrícula)'
               });
            }
          }
        }
      }
    }

    // 7. Consume invite use (race-condition safe)
    const consumed = await consumeInviteUse(invite.id, userId);
    if (!consumed) {
      // This means another request consumed it between our check and this point.
      // The user was already created, so we don't rollback — they're valid.
      console.warn(`[INVITE] Race condition on invite ${invite.id} — user created but invite already consumed`);
    }

    return {
      user_id: userId,
      academy_id: academyId,
      role,
    };
  } catch (err) {
    // Rollback: delete the auth user we just created
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (rollbackErr) {
      console.error('[INVITE] Failed to rollback auth user:', rollbackErr);
    }
    throw err;
  }
}

// ==========================================
// LIST INVITES
// ==========================================

export async function getInviteList(opts: {
  type?: InviteType;
  active?: boolean;
  academy_id?: string | null;
  page: number;
  limit: number;
}) {
  return listInvitesRepo(opts);
}

// ==========================================
// REVOKE INVITE
// ==========================================

export async function revokeInviteById(
  inviteId: string,
  actor: AuthenticatedUser
): Promise<void> {
  const invite = await findInviteById(inviteId);

  if (!invite) {
    throw new Error('Convite não encontrado');
  }

  // Only the creator or ADMIN_GLOBAL can revoke
  if (invite.created_by !== actor.id && actor.role !== 'ADMIN_GLOBAL') {
    throw new Error('Sem permissão para revogar este convite');
  }

  await revokeInviteRepo(inviteId);
}
