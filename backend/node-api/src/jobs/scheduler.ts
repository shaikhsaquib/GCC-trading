import cron   from 'node-cron';
import { logger } from '../core/logger';
import { expiredOrdersJob } from './handlers/expired-orders.job';
import { priceSnapshotJob } from './handlers/price-snapshot.job';
import { maturityAlertJob } from './handlers/maturity-alert.job';

function safeRun(name: string, fn: () => Promise<void>): () => void {
  return () => {
    fn().catch((err) =>
      logger.error(`Job "${name}" failed`, { error: (err as Error).message }),
    );
  };
}

export function startScheduler(): void {
  // Expired order cleanup — every 5 minutes
  cron.schedule('*/5 * * * *',  safeRun('expired-orders', expiredOrdersJob));

  // Bond price snapshots — every hour
  cron.schedule('0 * * * *',    safeRun('price-snapshot', priceSnapshotJob));

  // Maturity alerts — daily at 07:00 UTC
  cron.schedule('0 7 * * *',    safeRun('maturity-alerts', maturityAlertJob));

  logger.info('Scheduler started: 3 cron jobs active');
}
