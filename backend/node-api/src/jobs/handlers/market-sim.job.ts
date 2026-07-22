import { db }     from '../../core/database/postgres.client';
import { logger } from '../../core/logger';

/**
 * Market simulator — makes the venue look alive using REAL data, every second.
 *
 * Designed to be cheap enough to run at 1s cadence against a remote database:
 * every tick is a handful of SET-BASED statements over the whole fleet (not a
 * per-bond loop), and the market-maker's resting orders are repriced IN PLACE
 * (no row growth, no FK churn). Heavier work is throttled:
 *   - price movement + book reshape: every tick (~1s)
 *   - price_history snapshot:        every ~10 ticks (chart doesn't need 1s pts)
 *   - printed trades:                every ~3 ticks (a random subset of bonds)
 *   - pruning:                       every ~300 ticks (~5 min)
 *
 * No-ops until the order-book seed has created the market-maker account.
 */

const MM_HASH = 'seed-marketmaker-hash';
const STEP    = 0.0015;  // 0.15% between book levels

let running = false;   // skip a tick if the previous one is still in flight
let tick    = 0;

export async function marketSimJob(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const mm = await db.query<{ id: string }>(
      `SELECT id FROM app_auth.users WHERE email_hash = $1`, [MM_HASH],
    );
    const mmId = mm.rows[0]?.id;
    if (!mmId) {
      logger.debug('market-sim: no market-maker account — run the order-book seed first; skipping');
      return;
    }

    tick += 1;

    // 1. Move every active bond's price (bounded random walk) — one statement.
    await db.query(
      `UPDATE bonds.listings
         SET current_price = GREATEST(50, LEAST(3000,
             ROUND((current_price * (1 + (random() - 0.5) * 0.004))::numeric, 4)))
       WHERE status = 'Active'`,
    );

    // 2. Reprice the market-maker's book in place around each new mid — one
    //    statement. The level (1..5) is parsed from the idempotency key suffix.
    await db.query(
      `UPDATE trading.orders o
         SET price = CASE WHEN o.side = 'Buy'
               THEN ROUND((b.current_price * (1 - $2 * ((regexp_match(o.idempotency_key, '-([0-9]+)$'))[1])::int))::numeric, 4)
               ELSE ROUND((b.current_price * (1 + $2 * ((regexp_match(o.idempotency_key, '-([0-9]+)$'))[1])::int))::numeric, 4)
             END,
             quantity = GREATEST(1, ROUND((100 + (((regexp_match(o.idempotency_key, '-([0-9]+)$'))[1])::int - 1) * 60)
                                          * (0.7 + random() * 0.6))),
             status = 'Open'
       FROM bonds.listings b
       WHERE o.bond_id = b.id
         AND o.user_id = $1
         AND o.idempotency_key LIKE 'mm-%'
         AND b.status = 'Active'`,
      [mmId, STEP],
    );

    // 3. Snapshot price history every ~10s (bounded growth) — one statement.
    if (tick % 10 === 0) {
      await db.query(
        `INSERT INTO bonds.price_history (bond_id, price, recorded_at)
         SELECT id, current_price, NOW() FROM bonds.listings WHERE status = 'Active'`,
      );
    }

    // 4. Print real trades for a random subset of bonds every ~3 ticks — one
    //    statement (references the level-1 MM orders so the FK is satisfied).
    if (tick % 3 === 0) {
      await db.query(
        `INSERT INTO trading.trades
           (buy_order_id, sell_order_id, buyer_id, seller_id, bond_id, quantity, price,
            buyer_fee, seller_fee, settlement_fee, executed_at)
         SELECT buy.id, sell.id, $1, $1, b.id,
                ROUND(50 + random() * 300),
                b.current_price,
                ROUND((b.current_price * 0.0025)::numeric, 4),
                ROUND((b.current_price * 0.0025)::numeric, 4),
                ROUND((b.current_price * 0.001)::numeric, 4),
                NOW()
         FROM bonds.listings b
         JOIN trading.orders buy  ON buy.bond_id  = b.id AND buy.idempotency_key  = 'mm-' || b.id || '-buy-1'
         JOIN trading.orders sell ON sell.bond_id = b.id AND sell.idempotency_key = 'mm-' || b.id || '-sell-1'
         WHERE b.status = 'Active' AND random() < 0.5`,
        [mmId],
      );
    }

    // 5. Amortised pruning (~every 5 min) so storage stays bounded on free tier.
    if (tick % 300 === 0) {
      await db.query(
        `DELETE FROM trading.trades WHERE buyer_id = seller_id AND executed_at < NOW() - INTERVAL '2 hours'`,
      ).catch(() => undefined);
      await db.query(
        `DELETE FROM bonds.price_history WHERE recorded_at < NOW() - INTERVAL '3 days'`,
      ).catch(() => undefined);
    }
  } finally {
    running = false;
  }
}
