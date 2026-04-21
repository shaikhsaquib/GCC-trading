/**
 * Seed script — creates admin + two test trading accounts.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... ENCRYPTION_KEY=<64-hex-chars> \
 *   npx ts-node scripts/seed-test-users.ts
 *
 * Creates:
 *   admin@test.com   — role: ADMIN,    status: ACTIVE,  password: Admin1234!
 *   seller@test.com  — role: INVESTOR, status: ACTIVE,  password: Test1234!
 *   buyer@test.com   — role: INVESTOR, status: ACTIVE,  password: Test1234!
 *
 * Safe to re-run — skips any user whose email is already registered.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import crypto from 'crypto';

// ── Crypto helpers ────────────────────────────────────────────────────────────

function encrypt(plaintext: string, keyHex: string): string {
  const key      = Buffer.from(keyHex, 'hex');
  const iv       = crypto.randomBytes(16);
  const cipher   = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc      = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

function hashForLookup(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

// ── Users to create ───────────────────────────────────────────────────────────

const USERS = [
  {
    email:     'admin@test.com',
    password:  'Admin1234!',
    phone:     '+971500000001',
    firstName: 'Admin',
    lastName:  'User',
    role:      'ADMIN',
    riskLevel: 'HIGH',
  },
  {
    email:     'seller@test.com',
    password:  'Test1234!',
    phone:     '+971500000002',
    firstName: 'Ali',
    lastName:  'Seller',
    role:      'INVESTOR',
    riskLevel: 'HIGH',
  },
  {
    email:     'buyer@test.com',
    password:  'Test1234!',
    phone:     '+971500000003',
    firstName: 'Sara',
    lastName:  'Buyer',
    role:      'INVESTOR',
    riskLevel: 'HIGH',
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl         = process.env.DATABASE_URL;
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!dbUrl)         { console.error('❌  DATABASE_URL is required');   process.exit(1); }
  if (!encryptionKey) { console.error('❌  ENCRYPTION_KEY is required'); process.exit(1); }
  if (encryptionKey.length !== 64) {
    console.error('❌  ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    for (const u of USERS) {
      const emailHash = hashForLookup(u.email);

      const existing = await pool.query(
        `SELECT id FROM app_auth.users WHERE email_hash = $1`, [emailHash],
      );

      if (existing.rows.length > 0) {
        console.log(`⚠️  ${u.email} already exists — skipping`);
        continue;
      }

      const [passwordHash, encEmail, encPhone] = await Promise.all([
        bcrypt.hash(u.password, 12),
        Promise.resolve(encrypt(u.email,  encryptionKey)),
        Promise.resolve(encrypt(u.phone,  encryptionKey)),
      ]);

      const result = await pool.query(
        `INSERT INTO app_auth.users
           (email, email_hash, phone, password_hash, first_name, last_name,
            nationality, date_of_birth, preferred_currency, role, status)
         VALUES ($1,$2,$3,$4,$5,$6,'AE','1990-01-01','AED',$7,'ACTIVE')
         RETURNING id`,
        [encEmail, emailHash, encPhone, passwordHash, u.firstName, u.lastName, u.role],
      );

      const userId = result.rows[0].id;

      await pool.query(
        `INSERT INTO kyc.submissions (user_id, status, risk_level)
         VALUES ($1, 'Approved', $2)
         ON CONFLICT DO NOTHING`,
        [userId, u.riskLevel],
      );

      console.log(`✅  Created ${u.email}  (${u.role})  id: ${userId}`);
    }

    console.log('\nDone. You can now log in with:');
    console.log('  admin@test.com  /  Admin1234!   → full admin access');
    console.log('  seller@test.com /  Test1234!    → investor, can trade');
    console.log('  buyer@test.com  /  Test1234!    → investor, can trade');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
