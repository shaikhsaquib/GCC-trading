import { db }     from '../../core/database/postgres.client';
import { logger } from '../../core/logger';

export async function priceSnapshotJob(): Promise<void> {
  await db.query(`
    INSERT INTO bonds.price_history (bond_id, price, recorded_at)
    SELECT id, current_price, NOW()
    FROM bonds.listings
    WHERE status = 'Active'`);

  logger.debug('Price snapshots recorded');
}
