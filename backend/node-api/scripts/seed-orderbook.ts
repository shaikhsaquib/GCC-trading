/**
 * Seed script — populates resting limit orders so every active bond has a
 * visible order book with depth (bids below, asks above the current price).
 *
 * Without this, GET /orders/book/:bondId returns empty bids/asks because the
 * matching engine only ever shows *real* resting orders, and a fresh venue has
 * none — so every bond's book looks empty and market orders get rejected for
 * "no liquidity".
 *
 * It creates a single "market maker" account (well-funded wallet + generous
 * holdings) and places several price levels of buy & sell orders per bond, so
 * that real user orders can also match and settle against it.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... ENCRYPTION_KEY=<64-hex-chars> \
 *   npx ts-node scripts/seed-orderbook.ts
 *
 * Safe to re-run — order rows use deterministic idempotency keys and are
 * inserted with ON CONFLICT DO NOTHING.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import crypto from 'crypto';

function encrypt(plaintext: string, keyHex: string): string {
  const key    = Buffer.from(keyHex, 'hex');
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}
function hashForLookup(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

const MM = {
  email:     'marketmaker@gcc.local',
  password:  'MarketMaker1234!',
  phone:     '+971500000099',
  firstName: 'Market',
  lastName:  'Maker',
};

// Order-book shape per bond
const LEVELS      = 5;        // price levels each side
const STEP        = 0.0015;   // 0.15% between levels
const BASE_QTY    = 100;      // units at the tightest level
const QTY_GROWTH  = 60;       // extra units per level further out

async function main() {
  const dbUrl         = process.env.DATABASE_URL;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!dbUrl)         { console.error('❌  DATABASE_URL is required');   process.exit(1); }
  if (!encryptionKey) { console.error('❌  ENCRYPTION_KEY is required'); process.exit(1); }
  if (encryptionKey.length !== 64) {
    console.error('❌  ENCRYPTION_KEY must be 64 hex characters (32 bytes)'); process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  try {
    // 1. Ensure the market-maker user exists
    const emailHash = hashForLookup(MM.email);
    let mmId: string;
    const existing = await pool.query('SELECT id FROM app_auth.users WHERE email_hash = $1', [emailHash]);
    if (existing.rows.length > 0) {
      mmId = existing.rows[0].id;
      console.log(`⚠️  market maker already exists — id: ${mmId}`);
    } else {
      const [passwordHash, encEmail, encPhone] = await Promise.all([
        bcrypt.hash(MM.password, 12),
        Promise.resolve(encrypt(MM.email, encryptionKey)),
        Promise.resolve(encrypt(MM.phone, encryptionKey)),
      ]);
      const res = await pool.query(
        `INSERT INTO app_auth.users
           (email, email_hash, phone, password_hash, first_name, last_name,
            nationality, date_of_birth, preferred_currency, role, status)
         VALUES ($1,$2,$3,$4,$5,$6,'AE','1985-01-01','AED','INVESTOR','ACTIVE')
         RETURNING id`,
        [encEmail, emailHash, encPhone, passwordHash, MM.firstName, MM.lastName],
      );
      mmId = res.rows[0].id;
      await pool.query(
        `INSERT INTO kyc.submissions (user_id, status, risk_level)
         VALUES ($1, 'Approved', 'HIGH') ON CONFLICT DO NOTHING`, [mmId],
      );
      console.log(`✅  created market maker — id: ${mmId}`);
    }

    // 2. Fund the market maker's wallet generously (so buy fills have cash)
    await pool.query(
      `INSERT INTO wallet.wallets (user_id, currency, balance, available_balance, frozen_balance)
       VALUES ($1, 'AED', 1000000000, 1000000000, 0)
       ON CONFLICT (user_id) DO UPDATE
         SET balance = GREATEST(wallet.wallets.balance, 1000000000),
             available_balance = GREATEST(wallet.wallets.available_balance, 1000000000)`,
      [mmId],
    );

    // 3. For each active bond: give the MM inventory + place resting orders
    const bonds = await pool.query<{ id: string; current_price: string; name: string }>(
      `SELECT id, current_price, name FROM bonds.listings WHERE status = 'Active'`,
    );
    console.log(`Seeding order book for ${bonds.rows.length} bonds...`);

    let orderCount = 0;
    for (const b of bonds.rows) {
      const px = parseFloat(b.current_price);

      // Inventory so sell orders can settle
      await pool.query(
        `INSERT INTO portfolio.holdings (user_id, bond_id, quantity, avg_buy_price, current_value)
         VALUES ($1, $2, 100000, $3, $4)
         ON CONFLICT (user_id, bond_id) DO NOTHING`,
        [mmId, b.id, px.toFixed(4), (px * 100000).toFixed(4)],
      );

      for (let i = 1; i <= LEVELS; i++) {
        const qty     = BASE_QTY + (i - 1) * QTY_GROWTH;
        const bidPx   = +(px * (1 - STEP * i)).toFixed(4);
        const askPx   = +(px * (1 + STEP * i)).toFixed(4);

        const rows = [
          ['Buy',  bidPx, `mm-${b.id}-buy-${i}`],
          ['Sell', askPx, `mm-${b.id}-sell-${i}`],
        ] as const;

        for (const [side, price, idem] of rows) {
          const r = await pool.query(
            `INSERT INTO trading.orders
               (user_id, bond_id, side, order_type, quantity, filled_quantity,
                price, status, idempotency_key)
             VALUES ($1,$2,$3,'Limit',$4,0,$5,'Open',$6)
             ON CONFLICT (idempotency_key) DO NOTHING
             RETURNING id`,
            [mmId, b.id, side, qty, price, idem],
          );
          if ((r.rowCount ?? 0) > 0) orderCount++;
        }
      }
    }

    console.log(`\n✅  Done. Inserted ${orderCount} new resting orders across ${bonds.rows.length} bonds.`);
    console.log('    Order books now show depth; re-run any time (idempotent).');
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });
