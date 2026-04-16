import { PoolClient } from 'pg';
import { db } from '../../core/database/postgres.client';
import { UserRow } from './auth.types';

/**
 * AuthRepository — all SQL for the auth module lives here.
 * Services receive an instance via constructor injection.
 */
export class AuthRepository {
  async findByEmailHash(emailHash: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>(
      'SELECT * FROM app_auth.users WHERE email_hash = $1 LIMIT 1',
      [emailHash],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>(
      'SELECT * FROM app_auth.users WHERE id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create(params: {
    email:              string;
    emailHash:          string;
    phone:              string;
    passwordHash:       string;
    firstName:          string;
    lastName:           string;
    nationality:        string;
    dateOfBirth:        string;
    preferredCurrency:  string;
  }): Promise<UserRow> {
    const result = await db.query<UserRow>(
      `INSERT INTO app_auth.users
         (email, email_hash, phone, password_hash, first_name, last_name,
          nationality, date_of_birth, preferred_currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        params.email, params.emailHash, params.phone, params.passwordHash,
        params.firstName, params.lastName, params.nationality,
        params.dateOfBirth, params.preferredCurrency,
      ],
    );
    return result.rows[0];
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await db.query('UPDATE app_auth.users SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
  }

  async updateLastLogin(id: string): Promise<void> {
    await db.query(
      'UPDATE app_auth.users SET last_login_at = NOW(), failed_login_count = 0, locked_until = NULL WHERE id = $1',
      [id],
    );
  }

  async incrementFailedLogins(id: string): Promise<void> {
    await db.query(
      'UPDATE app_auth.users SET failed_login_count = failed_login_count + 1, updated_at = NOW() WHERE id = $1',
      [id],
    );
  }

  async lockUntil(id: string, until: Date): Promise<void> {
    await db.query(
      'UPDATE app_auth.users SET locked_until = $1, updated_at = NOW() WHERE id = $2',
      [until, id],
    );
  }

  async saveTotpSecret(id: string, secret: string): Promise<void> {
    await db.query(
      'UPDATE app_auth.users SET totp_secret = $1, updated_at = NOW() WHERE id = $2',
      [secret, id],
    );
  }

  async enableTotp(id: string): Promise<void> {
    await db.query(
      'UPDATE app_auth.users SET totp_enabled = TRUE, updated_at = NOW() WHERE id = $1',
      [id],
    );
  }

  async savePasswordHash(id: string, hash: string, client?: PoolClient): Promise<void> {
    const q = client ?? db;
    await q.query(
      'UPDATE app_auth.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, id],
    );
  }

  async savePasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.query(
      `INSERT INTO app_auth.password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET token_hash = $2, expires_at = $3, used = FALSE`,
      [userId, tokenHash, expiresAt],
    );
  }

  async findPasswordReset(tokenHash: string): Promise<{ user_id: string; expires_at: Date; used: boolean } | null> {
    const result = await db.query<{ user_id: string; expires_at: Date; used: boolean }>(
      'SELECT user_id, expires_at, used FROM app_auth.password_resets WHERE token_hash = $1',
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async markPasswordResetUsed(tokenHash: string): Promise<void> {
    await db.query(
      'UPDATE app_auth.password_resets SET used = TRUE WHERE token_hash = $1',
      [tokenHash],
    );
  }
}
