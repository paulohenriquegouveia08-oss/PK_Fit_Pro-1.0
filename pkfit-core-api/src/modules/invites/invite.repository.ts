import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import type { InviteType } from '../../types/common.types.js';

// ==========================================
// TYPES
// ==========================================

export interface InviteRecord {
  id: string;
  code: string;
  type: InviteType;
  academy_id: string | null;
  created_by: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  max_uses: number;
  current_uses: number;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface InsertInviteData {
  code: string;
  type: InviteType;
  academy_id: string | null;
  created_by: string;
  expires_at: string;
  max_uses: number;
  metadata: Record<string, unknown>;
}

// ==========================================
// QUERIES
// ==========================================

const supabase = () => getSupabaseAdmin();

/**
 * Insert a new invite code into the database.
 */
export async function insertInvite(data: InsertInviteData): Promise<InviteRecord> {
  const { data: invite, error } = await supabase()
    .from('invite_codes')
    .insert({
      code: data.code,
      type: data.type,
      academy_id: data.academy_id,
      created_by: data.created_by,
      expires_at: data.expires_at,
      max_uses: data.max_uses,
      metadata: data.metadata,
      is_active: true,
      current_uses: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar convite: ${error.message}`);
  return invite as InviteRecord;
}

/**
 * Find an active, non-expired invite by its code.
 */
export async function findActiveInviteByCode(code: string): Promise<InviteRecord | null> {
  const { data, error } = await supabase()
    .from('invite_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error && error.code === 'PGRST116') return null; // No rows
  if (error) throw new Error(`Erro ao buscar convite: ${error.message}`);
  return data as InviteRecord;
}

/**
 * Atomically consume one use of an invite code.
 * Uses a conditional update to prevent race conditions.
 *
 * Returns the updated record, or null if the invite was already fully consumed.
 */
export async function consumeInviteUse(
  inviteId: string,
  usedBy: string
): Promise<InviteRecord | null> {
  // First, get current state
  const { data: current, error: fetchError } = await supabase()
    .from('invite_codes')
    .select('current_uses, max_uses')
    .eq('id', inviteId)
    .eq('is_active', true)
    .single();

  if (fetchError || !current) return null;

  if (current.current_uses >= current.max_uses) return null;

  const newUses = current.current_uses + 1;
  const isFullyUsed = newUses >= current.max_uses;

  const { data: updated, error: updateError } = await supabase()
    .from('invite_codes')
    .update({
      current_uses: newUses,
      used_by: usedBy,
      used_at: new Date().toISOString(),
      is_active: !isFullyUsed, // Deactivate if fully consumed
    })
    .eq('id', inviteId)
    .eq('current_uses', current.current_uses) // Optimistic concurrency check
    .select()
    .single();

  if (updateError) {
    // Race condition — another request consumed it first
    if (updateError.code === 'PGRST116') return null;
    throw new Error(`Erro ao consumir convite: ${updateError.message}`);
  }

  return updated as InviteRecord;
}

/**
 * Revoke (deactivate) an invite code.
 */
export async function revokeInvite(inviteId: string): Promise<boolean> {
  const { error } = await supabase()
    .from('invite_codes')
    .update({ is_active: false })
    .eq('id', inviteId);

  if (error) throw new Error(`Erro ao revogar convite: ${error.message}`);
  return true;
}

/**
 * List invite codes with filtering and pagination.
 */
export async function listInvites(opts: {
  type?: InviteType;
  active?: boolean;
  academy_id?: string | null;
  page: number;
  limit: number;
}): Promise<{ invites: InviteRecord[]; total: number }> {
  let query = supabase()
    .from('invite_codes')
    .select('*', { count: 'exact' });

  if (opts.type) {
    query = query.eq('type', opts.type);
  }

  if (opts.active !== undefined) {
    query = query.eq('is_active', opts.active);
  }

  if (opts.academy_id) {
    query = query.eq('academy_id', opts.academy_id);
  }

  const offset = (opts.page - 1) * opts.limit;
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + opts.limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Erro ao listar convites: ${error.message}`);

  return {
    invites: (data || []) as InviteRecord[],
    total: count || 0,
  };
}

/**
 * Find invite by ID.
 */
export async function findInviteById(id: string): Promise<InviteRecord | null> {
  const { data, error } = await supabase()
    .from('invite_codes')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw new Error(`Erro ao buscar convite: ${error.message}`);
  return data as InviteRecord;
}
