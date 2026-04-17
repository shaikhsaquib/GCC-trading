import cron   from 'node-cron';
import { logger } from '../core/logger';
import { expiredOrdersJob } from './handlers/expired-orders.job';
import { priceSnapshotJob } from './handlers/price-snapshot.job';
import { maturityAlertJob } from './handlers/maturity-alert.job';

interface JobStatus {
  name:          string;
  schedule:      string;
  description:   string;
  lastRunAt:     string | null;
  lastStatus:    'success' | 'failed' | null;
  lastDurationMs: number | null;
  runsToday:     number;
}

const jobStatus = new Map<string, JobStatus>([
  ['expired-orders', {
    name: 'expired-orders', schedule: '*/5 * * * *',
    description: 'Cancel unfilled orders past their TTL',
    lastRunAt: null, lastStatus: null, lastDurationMs: null, runsToday: 0,
  }],
  ['price-snapshot', {
    name: 'price-snapshot', schedule: '0 * * * *',
    description: 'Persist hourly bond price snapshots to DB',
    lastRunAt: null, lastStatus: null, lastDurationMs: null, runsToday: 0,
  }],
  ['maturity-alerts', {
    name: 'maturity-alerts', schedule: '0 7 * * *',
    description: 'Notify holders of bonds maturing within 30 days',
    lastRunAt: null, lastStatus: null, lastDurationMs: null, runsToday: 0,
  }],
]);

export function getSchedulerStatus(): JobStatus[] {
  return Array.from(jobStatus.values());
}

function safeRun(name: string, fn: () => Promise<void>): () => void {
  return () => {
    const start = Date.now();
    const job   = jobStatus.get(name)!;
    fn()
      .then(() => {
        jobStatus.set(name, {
          ...job,
          lastRunAt:      new Date().toISOString(),
          lastStatus:     'success',
          lastDurationMs: Date.now() - start,
          runsToday:      job.runsToday + 1,
        });
      })
      .catch((err) => {
        jobStatus.set(name, {
          ...job,
          lastRunAt:      new Date().toISOString(),
          lastStatus:     'failed',
          lastDurationMs: Date.now() - start,
          runsToday:      job.runsToday + 1,
        });
        logger.error(`Job "${name}" failed`, { error: (err as Error).message });
      });
  };
}

export function startScheduler(): void {
  cron.schedule('*/5 * * * *',  safeRun('expired-orders', expiredOrdersJob));
  cron.schedule('0 * * * *',    safeRun('price-snapshot', priceSnapshotJob));
  cron.schedule('0 7 * * *',    safeRun('maturity-alerts', maturityAlertJob));

  logger.info('Scheduler started: 3 cron jobs active');
}
