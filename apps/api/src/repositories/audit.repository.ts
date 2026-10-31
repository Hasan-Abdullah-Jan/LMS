import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../config/logger.js';
import { unwrapList } from '../lib/db.js';
import { toRange, type Pagination } from '../lib/pagination.js';
import type { Json } from '../types/database.types.js';

export interface AuditEntry {
  id: number;
  actor: { id: string; fullName: string } | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Json;
  at: string;
}

export const auditRepository = {
  /**
   * Append to the audit trail. Never throws: a failed audit write is logged
   * but must not undo the user's (already committed) action.
   */
  async record(
    actorId: string,
    action: string,
    entity: string,
    entityId: string | null,
    details: Record<string, Json | undefined> = {},
  ): Promise<void> {
    const { error } = await supabaseAdmin.from('audit_log').insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId,
      details: details as { [key: string]: Json | undefined },
    });
    if (error) logger.error({ err: error.message, action, entity }, 'Audit log write failed');
  },

  async list(pagination: Pagination): Promise<{ rows: AuditEntry[]; total: number }> {
    const [from, to] = toRange(pagination);
    const result = await supabaseAdmin
      .from('audit_log')
      .select('id, action, entity, entity_id, details, at, actor:profiles(id, full_name)', {
        count: 'exact',
      })
      .order('at', { ascending: false })
      .range(from, to);
    const rows = unwrapList(result, 'Audit entry');
    return {
      total: result.count ?? rows.length,
      rows: rows.map((row) => ({
        id: row.id,
        actor: row.actor ? { id: row.actor.id, fullName: row.actor.full_name } : null,
        action: row.action,
        entity: row.entity,
        entityId: row.entity_id,
        details: row.details,
        at: row.at,
      })),
    };
  },
};
