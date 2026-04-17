import { NotificationLog, INotificationLog } from '../../core/database/mongodb.client';
import { NotificationEvent, NotificationChannel } from './notifications.types';

export class NotificationsRepository {
  async create(params: {
    userId:    string;
    eventType: NotificationEvent;
    channels:  NotificationChannel[];
    vars:      Record<string, string>;
  }): Promise<INotificationLog> {
    return NotificationLog.create({
      user_id:    params.userId,
      event_type: params.eventType,
      channels:   params.channels,
      vars:       params.vars,
    });
  }

  async findByUserId(userId: string, limit: number, offset: number): Promise<{
    data:  INotificationLog[];
    total: number;
  }> {
    const [data, total] = await Promise.all([
      NotificationLog.find({ user_id: userId })
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      NotificationLog.countDocuments({ user_id: userId }),
    ]);
    return { data: data as INotificationLog[], total };
  }

  async markRead(id: string, userId: string): Promise<void> {
    await NotificationLog.findOneAndUpdate({ _id: id, user_id: userId }, { read: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await NotificationLog.updateMany({ user_id: userId, read: false }, { read: true });
  }
}
