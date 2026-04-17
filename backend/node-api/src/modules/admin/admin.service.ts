import { ForbiddenError } from '../../core/errors';
import { AdminRepository } from './admin.repository';
import { AuditService }    from '../audit/audit.service';
import { UserListFilter }  from './admin.types';

export class AdminService {
  constructor(
    private readonly repo:  AdminRepository,
    private readonly audit: AuditService,
  ) {}

  async getDashboard() {
    return this.repo.getDashboardStats();
  }

  async listUsers(filter: UserListFilter) {
    return this.repo.listUsers(filter);
  }

  async suspendUser(targetId: string, actorId: string): Promise<void> {
    if (targetId === actorId) throw new ForbiddenError('Cannot suspend yourself');
    await this.repo.updateUserStatus(targetId, 'SUSPENDED');
    await this.audit.log({
      event_type:  'USER_SUSPENDED',
      action:      'suspend',
      actor_id:    actorId,
      target_id:   targetId,
      target_type: 'USER',
    });
  }

  async activateUser(targetId: string, actorId: string): Promise<void> {
    await this.repo.updateUserStatus(targetId, 'ACTIVE');
    await this.audit.log({
      event_type:  'USER_ACTIVATED',
      action:      'activate',
      actor_id:    actorId,
      target_id:   targetId,
      target_type: 'USER',
    });
  }

  async getDailyReport() {
    return this.repo.getDailyReport();
  }
}
