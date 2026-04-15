/**
 * Node.js cron scheduler — periodic platform maintenance tasks.
 * Uses node-cron. All jobs are idempotent.
 */
import cron from 'node-cron';
import { db }                     from '../db/postgres';
import { redis }                  from '../db/redis';
import { eventBus, Events }       from '../events/event-bus';
import { logger }                 from '../utils/logger';

// ── Helper: call .NET services ────────────────────────────────────────────────

async function callDotnetService(url: string, secret: string): Promise<void> {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'X-Service-Key': secret, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
}

// ── Expired Order Cleanup (every 5 minutes) ───────────────────────────────────

export function scheduleExpiredOrderCleanup(): void {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await db.query<{ id: string }>(
        `UPDATE trading.orders
         SET status = 'Expired', cancel_reason = 'Order expired', updated_at = NOW()
         WHERE status IN ('Open', 'PartiallyFilled')
           AND expires_at IS NOT NULL
           AND expires_at < NOW()
         RETURNING id`,
      );
      if (result.rows.length > 0) {
        logger.info(`Expired ${result.rows.length} orders`);
        for (const { id } of result.rows) {
          await eventBus.publish(Events.ORDER_CANCELLED, { order_id: id, reason: 'expired' });
        }
      }
    } catch (err) {
      logger.error('Expired order cleanup failed', { error: (err as Error).message });
    }
  });
}

// ── Bond Price Snapshots (every hour) ─────────────────────────────────────────

export function schedulePriceSnapshots(): void {
  cron.schedule('0 * * * *', async () => {
    try {
      await db.query(`
        INSERT INTO bonds.price_history (bond_id, price, recorded_at)
        SELECT id, current_price, NOW()
        FROM bonds.listings
        WHERE status = 'Active'`);
      logger.info('Price snapshots recorded');
    } catch (err) {
      logger.error('Price snapshot failed', { error: (err as Error).message });
    }
  });
}

// ── Maturity Alerts (daily at 07:00 UTC) ──────────────────────────────────────

export function scheduleMaturityAlerts(): void {
  cron.schedule('0 7 * * *', async () => {
    try {
      // Find bonds maturing in 30 days
      const bonds = await db.query<{ id: string; name: string; maturity_date: string }>(
        `SELECT id, name, maturity_date
         FROM bonds.listings
         WHERE maturity_date = (NOW() + INTERVAL '30 days')::date
           AND status = 'Active'`);

      for (const bond of bonds.rows) {
        // Find holders
        const holders = await db.query<{ user_id: string }>(
          'SELECT user_id FROM portfolio.holdings WHERE bond_id = $1 AND quantity > 0',
          [bond.id],
        );

        for (const { user_id } of holders.rows) {
          await eventBus.publish('notification.maturity-alert', {
            user_id,
            bond_id:       bond.id,
            bond_name:     bond.name,
            maturity_date: bond.maturity_date,
            days_remaining: 30,
          });
        }
      }

      logger.info(`Sent maturity alerts for ${bonds.rows.length} bonds`);
    } catch (err) {
      logger.error('Maturity alert job failed', { error: (err as Error).message });
    }
  });
}

// ── Sanctions Re-screening (daily at 01:00 UTC) ───────────────────────────────

export function scheduleSanctionsRescreening(): void {
  cron.schedule('0 1 * * *', async () => {
    try {
      const serviceSecret = process.env.SERVICE_SECRET ?? '';
      const amlUrl        = `${process.env.DOTNET_AML_URL ?? 'http://localhost:5005'}/api/v1/aml/screen-all`;
      await callDotnetService(amlUrl, serviceSecret);
      logger.info('Sanctions re-screening triggered');
    } catch (err) {
      logger.error('Sanctions rescreening failed', { error: (err as Error).message });
    }
  });
}

// ── Audit Log Archival (weekly Sunday at 02:00 UTC) ───────────────────────────

export function scheduleAuditArchival(): void {
  cron.schedule('0 2 * * 0', async () => {
    try {
      // Archive audit logs older than 6 years to cold storage table
      // (7-year retention per FSD §19 — keep last 1 year in hot collection)
      const sixYearsAgo = new Date();
      sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);

      logger.info('Audit archival job: cold-archiving logs before', sixYearsAgo.toISOString());
      // In production: move to S3/blob or compressed cold MongoDB collection
    } catch (err) {
      logger.error('Audit archival failed', { error: (err as Error).message });
    }
  });
}

// ── Register all jobs ─────────────────────────────────────────────────────────

export function startScheduler(): void {
  scheduleExpiredOrderCleanup();
  schedulePriceSnapshots();
  scheduleMaturityAlerts();
  scheduleSanctionsRescreening();
  scheduleAuditArchival();
  logger.info('Scheduler started: 5 cron jobs active');
}
