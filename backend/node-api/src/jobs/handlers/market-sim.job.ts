import { db }     from '../../core/database/postgres.client';
import { logger } from '../../core/logger';

/**
 * Market simulator — makes the venue look alive using REAL data.
 *
 * Each run, for every active bond it:
 *   1. Nudges current_price with a gentle bounded random walk (and records a
 *      price_history point, so charts move from real data).
 *   2. Reshapes the market-maker's resting orders IN PLACE around the new mid
 *      (upsert by deterministic idempotency key — no row accumulation, no FK
 *      issues), so the order book visibly shifts each refresh.
 *   3. Occasionally prints a real trade into trading.trades, so the recent-
 *      trades feed is genuine rather than client-side fabricated.
 *
 * Requires the market-maker account from 003_seed_orderbook.sql / seed-orderbook.
 * If it isn't present, the job no-ops (so it's safe before seeding).
 *
 * Cheap-by-design for free tier: orders are upserted (fixed ~240 rows), and old
 * simulated trades / stale price history are pruned so storage stays bounded.
 */

const MM_HASH = 'seed-marketmaker-hash';
const LEVELS  = 5;
const STEP    = 0.0015;  // 0.15% between book levels

export async function marketSimJob(): Promise<void> {
  const mm = await db.query<{ id: string }>(
    `SELECT id FROM app_auth.users WHERE email_hash = $1`, [MM_HASH],
  );
  const mmId = mm.rows[0]?.id;
  if (!mmId) {
    logger.debug('market-sim: no market-maker account — run the order-book seed first; skipping');
    return;
  }

  const bonds = await db.query<{ id: string; current_price: string }>(
    `SELECT id, current_price FROM bonds.listings WHERE status = 'Active'`,
  );

  for (const b of bonds.rows) {
    try {
      await simulateBond(mmId, b.id, parseFloat(b.current_price));
    } catch (err) {
      logger.warn('market-sim: bond tick failed', { bondId: b.id, error: (err as Error).message });
    }
  }

  // Amortised cleanup (~1 run in 20) so storage stays bounded on free tier.
  if (Math.random() < 0.05) {
    await db.query(
      `DELETE FROM trading.trades WHERE buyer_id = seller_id AND executed_at < NOW() - INTERVAL '2 hours'`,
    ).catch(() => undefined);
    await db.query(
      `DELETE FROM bonds.price_history WHERE recorded_at < NOW() - INTERVAL '7 days'`,
    ).catch(() => undefined);
  }

  logger.debug(`market-sim: ticked ${bonds.rows.length} bonds`);
}

async function simulateBond(mmId: string, bondId: string, cur: number): Promise<void> {
  await db.transaction(async (client) => {
    // 1. Gentle bounded random walk (±0.2% per tick)
    const step = (Math.random() - 0.5) * 0.004;
    const next = Math.max(50, Math.min(3000, +(cur * (1 + step)).toFixed(4)));

    await client.query('UPDATE bonds.listings SET current_price = $1 WHERE id = $2', [next, bondId]);
    await client.query(
      'INSERT INTO bonds.price_history (bond_id, price, recorded_at) VALUES ($1, $2, NOW())',
      [bondId, next],
    );

    // 2. Reshape the MM book in place (upsert by deterministic key)
    const ids: Record<'Buy' | 'Sell', string[]> = { Buy: [], Sell: [] };
    for (let i = 1; i <= LEVELS; i++) {
      const qty   = Math.round((100 + (i - 1) * 60) * (0.7 + Math.random() * 0.6));
      const bidPx = +(next * (1 - STEP * i)).toFixed(4);
      const askPx = +(next * (1 + STEP * i)).toFixed(4);
      for (const [side, price] of [['Buy', bidPx], ['Sell', askPx]] as const) {
        const r = await client.query<{ id: string }>(
          `INSERT INTO trading.orders
             (user_id, bond_id, side, order_type, quantity, filled_quantity, price, status, idempotency_key)
           VALUES ($1,$2,$3,'Limit',$4,0,$5,'Open',$6)
           ON CONFLICT (idempotency_key) DO UPDATE
             SET price = EXCLUDED.price, quantity = EXCLUDED.quantity, status = 'Open'
           RETURNING id`,
          [mmId, bondId, side, qty, price, `mm-${bondId}-${side.toLowerCase()}-${i}`],
        );
        ids[side].push(r.rows[0].id);
      }
    }

    // 3. ~50% chance: print a real trade near the mid
    if (Math.random() < 0.5) {
      const buyId = ids.Buy[0], sellId = ids.Sell[0];
      const tqty  = Math.round(50 + Math.random() * 300);
      const tpx   = +next.toFixed(4);
      const notional = tpx * tqty;
      await client.query(
        `INSERT INTO trading.trades
           (buy_order_id, sell_order_id, buyer_id, seller_id, bond_id, quantity, price,
            buyer_fee, seller_fee, settlement_fee, executed_at)
         VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [buyId, sellId, mmId, bondId, tqty, tpx,
         +(notional * 0.0025).toFixed(4), +(notional * 0.0025).toFixed(4), +(notional * 0.001).toFixed(4)],
      );
    }
  });
}
