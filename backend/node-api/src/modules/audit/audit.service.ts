import { logger } from '../../core/logger';
import { AuditRepository } from './audit.repository';
import { LogAuditDto, AuditQueryFilter } from './audit.types';

export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  /**
   * Log an immutable audit event.
   * Never throws — audit failure must not break the main flow.
   */
  async log(dto: LogAuditDto): Promise<void> {
    try {
      await this.repo.create({ ...dto, created_at: new Date() } as any);
    } catch (err) {
      logger.error('Audit log write failed', { error: (err as Error).message, event: dto.event_type });
    }
  }

  async query(filter: AuditQueryFilter) {
    return this.repo.query(filter);
  }
}
