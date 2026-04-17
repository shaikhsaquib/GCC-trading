import { db }       from '../../core/database/postgres.client';
import { eventBus } from '../../core/events/event-bus';
import { logger }   from '../../core/logger';

export async function maturityAlertJob(): Promise<void> {
  // Alert for bonds maturing in exactly 30 days
  const bonds = await db.query<{ id: string; name: string; isin: string; maturity_date: string }>(
    `SELECT id, name, isin, maturity_date
     FROM bonds.listings
     WHERE maturity_date = (NOW() + INTERVAL '30 days')::date
       AND status = 'Active'`,
  );

  for (const bond of bonds.rows) {
    const holders = await db.query<{ user_id: string }>(
      'SELECT user_id FROM portfolio.holdings WHERE bond_id = $1 AND quantity > 0',
      [bond.id],
    );

    await Promise.allSettled(
      holders.rows.map(({ user_id }) =>
        eventBus.publish('notification.maturity-alert', {
          user_id,
          bond_id:        bond.id,
          bond_name:      bond.name,
          isin:           bond.isin,
          maturity_date:  bond.maturity_date,
          days_remaining: '30',
        }),
      ),
    );
  }

  if (bonds.rows.length > 0) {
    logger.info(`Maturity alerts sent for ${bonds.rows.length} bonds`);
  }
}
