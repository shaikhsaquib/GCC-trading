/**
 * One-time bootstrap script — creates the initial ADMIN user.
 *
 * Usage (against any environment):
 *   DATABASE_URL=postgresql://... ENCRYPTION_KEY=... \
 *   npx ts-node scripts/create-admin.ts \
 *     --email admin@gcc.com \
 *     --password "Admin1234!" \
 *     --firstName Admin \
 *     --lastName User \
 *     --phone "+971500000000"
 *
 * Or set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_FIRST / ADMIN_LAST / ADMIN_PHONE
 * as environment variables and omit the flags.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import crypto from 'crypto';

// ── Parse args ───────────────────────────────────────────────────────────────

function arg(flag: string, envKey: string, fallback?: string): string {
  const idx = process.argv.indexOf(`--${flag}`);
  const val = idx !== -1 ? process.argv[idx + 1] : (process.env[envKey] ?? fallback);
  if (!val) { console.error(`Missing --${flag} or ${envKey}`); process.exit(1); }
  return val;
}

const email     = arg('email',     'ADMIN_EMAIL');
const password  = arg('password',  'ADMIN_PASSWORD');
const firstName = arg('firstName', 'ADMIN_FIRST',   'Admin');
const lastName  = arg('lastName',  'ADMIN_LAST',    'User');
const phone     = arg('phone',     'ADMIN_PHONE',   '+9710000000000');

// ── Crypto helpers (inline — no dependency on config bootstrap) ───────────────

const ALGORITHM = 'aes-256-cbc';

function encrypt(plaintext: string, keyHex: string): string {
  const key       = Buffer.from(keyHex, 'hex');
  const iv        = crypto.randomBytes(16);
  const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function hashForLookup(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dbUrl        = process.env.DATABASE_URL;
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!dbUrl)        { console.error('DATABASE_URL is required'); process.exit(1); }
  if (!encryptionKey) { console.error('ENCRYPTION_KEY is required'); process.exit(1); }
  if (encryptionKey.length !== 64) {
    console.error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    // Check for existing admin
    const existing = await pool.query(
      `SELECT id, email FROM app_auth.users WHERE role IN ('ADMIN','L2_ADMIN') LIMIT 1`,
    );
    if (existing.rows.length > 0) {
      console.log('⚠️  An admin user already exists. Exiting without changes.');
      console.log(`   Existing admin ID: ${existing.rows[0].id}`);
      process.exit(0);
    }

    // Check email not already registered
    const emailHash = hashForLookup(email);
    const dupe = await pool.query(
      `SELECT id FROM app_auth.users WHERE email_hash = $1`, [emailHash],
    );
    if (dupe.rows.length > 0) {
      console.log(`⚠️  Email already registered (id: ${dupe.rows[0].id}).`);
      console.log('   Run the promote query below to make them admin:');
      console.log(`   UPDATE app_auth.users SET role = 'ADMIN', status = 'ACTIVE' WHERE id = '${dupe.rows[0].id}';`);
      process.exit(0);
    }

    console.log('Creating admin user...');

    const [passwordHash, encEmail, encPhone] = await Promise.all([
      bcrypt.hash(password, 12),
      Promise.resolve(encrypt(email, encryptionKey)),
      Promise.resolve(encrypt(phone, encryptionKey)),
    ]);

    const result = await pool.query(
      `INSERT INTO app_auth.users
         (email, email_hash, phone, password_hash, first_name, last_name,
          nationality, date_of_birth, preferred_currency, role, status)
       VALUES ($1,$2,$3,$4,$5,$6,'AE','1990-01-01','AED','ADMIN','ACTIVE')
       RETURNING id`,
      [encEmail, emailHash, encPhone, passwordHash, firstName, lastName],
    );

    const userId = result.rows[0].id;

    // Insert approved KYC so admin can also trade in tests
    await pool.query(
      `INSERT INTO kyc.submissions (user_id, status, risk_level)
       VALUES ($1, 'Approved', 'HIGH')
       ON CONFLICT DO NOTHING`,
      [userId],
    );

    console.log('');
    console.log('✅  Admin user created successfully!');
    console.log(`   ID:    ${userId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role:  ADMIN`);
    console.log(`   Status: ACTIVE`);
    console.log('');
    console.log('Log in at /auth/login with these credentials.');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
