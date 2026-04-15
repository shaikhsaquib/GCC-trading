import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../../shared/db/mongodb';
import { logger } from '../../shared/utils/logger';

// ── Audit Service — FSD §AML-004, §ADM-005 ───────────────────────────────────

export const auditService = {
  /**
   * Log an immutable audit event.
   * Every significant action in the platform must call this.
   */
  log: async (params: {
    event_type:     string;
    action:         string;
    actor_id?:      string;
    actor_role?:    string;
    target_id?:     string;
    target_type?:   string;
    metadata?:      Record<string, unknown>;
    ip_address?:    string;
    user_agent?:    string;
    correlation_id?: string;
  }): Promise<void> => {
    try {
      await AuditLog.create({
        event_id:       uuidv4(),
        event_type:     params.event_type,
        action:         params.action,
        actor_id:       params.actor_id,
        actor_role:     params.actor_role,
        target_id:      params.target_id,
        target_type:    params.target_type,
        metadata:       params.metadata ?? {},
        ip_address:     params.ip_address,
        user_agent:     params.user_agent,
        correlation_id: params.correlation_id,
      });
    } catch (err) {
      // Audit failures must never break the main flow
      logger.error('Audit log write failed', { error: (err as Error).message, params });
    }
  },

  // ── Query audit logs (admin only) ──────────────────────────────────────────
  query: async (filters: {
    actor_id?:    string;
    target_id?:   string;
    event_type?:  string;
    from?:        string;
    to?:          string;
    page?:        number;
    limit?:       number;
  }) => {
    const { actor_id, target_id, event_type, from, to, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (actor_id)   query.actor_id   = actor_id;
    if (target_id)  query.target_id  = target_id;
    if (event_type) query.event_type = event_type;
    if (from || to) {
      query.created_at = {};
      if (from) (query.created_at as Record<string, Date>)['$gte'] = new Date(from);
      if (to)   (query.created_at as Record<string, Date>)['$lte'] = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    return { logs, total, page, limit };
  },
};
