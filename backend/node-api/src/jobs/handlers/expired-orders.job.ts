import { db }       from '../../core/database/postgres.client';
import { eventBus } from '../../core/events/event-bus';
import { EventRoutes } from '../../core/events/event.types';
import { logger }   from '../../core/logger';

export async function expiredOrdersJob(): Promise<void> {
  const result = await db.query<{ id: string }>(
    `UPDATE trading.orders
     SET status = 'Expired', cancel_reason = 'Time in force expired', updated_at = NOW()
     WHERE status IN ('Open','PartiallyFilled')
       AND expires_at IS NOT NULL
       AND expires_at < NOW()
     RETURNING id`,
  );

  if (result.rows.length > 0) {
    logger.info(`Expired ${result.rows.length} orders`);
    await Promise.allSettled(
      result.rows.map(({ id }) =>
        eventBus.publish(EventRoutes.ORDER_CANCELLED, { order_id: id, reason: 'expired' }),
      ),
    );
  }
}
