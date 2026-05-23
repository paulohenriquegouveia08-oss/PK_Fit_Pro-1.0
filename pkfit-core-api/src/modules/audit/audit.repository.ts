import { getSupabaseAdmin } from '../../infra/database/supabase-admin.js';
import type { AuditEntry } from '../../types/common.types.js';

/**
 * Persists an audit log entry to the database.
 * Fire-and-forget — errors are logged but never bubble up.
 */
export async function createAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    await supabase.from('audit_logs').insert({
      actor_id: entry.actor_id,
      actor_role: entry.actor_role,
      action: entry.action,
      target_type: entry.target_type,
      target_id: entry.target_id,
      academy_id: entry.academy_id,
      metadata: entry.metadata,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
    });
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log:', err);
  }
}
