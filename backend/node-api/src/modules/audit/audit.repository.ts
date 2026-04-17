import { Document } from 'mongoose';
import { AuditLog, IAuditLog } from '../../core/database/mongodb.client';
import { AuditQueryFilter } from './audit.types';

export class AuditRepository {
  async create(data: Omit<IAuditLog, keyof Document | '_id'>): Promise<IAuditLog> {
    return AuditLog.create(data);
  }

  async query(filter: AuditQueryFilter): Promise<{ data: IAuditLog[]; total: number }> {
    const query: Record<string, unknown> = {};

    if (filter.actor_id)   query['actor_id']   = filter.actor_id;
    if (filter.target_id)  query['target_id']  = filter.target_id;
    if (filter.event_type) query['event_type'] = filter.event_type;

    if (filter.from || filter.to) {
      query['created_at'] = {
        ...(filter.from ? { $gte: new Date(filter.from) } : {}),
        ...(filter.to   ? { $lte: new Date(filter.to)   } : {}),
      };
    }

    const limit  = filter.limit  ?? 50;
    const offset = filter.offset ?? 0;

    const [data, total] = await Promise.all([
      AuditLog.find(query).sort({ created_at: -1 }).skip(offset).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    return { data: data as unknown as IAuditLog[], total };
  }
}
