import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../shared/db/postgres';
import { redis } from '../../shared/db/redis';
import { eventBus, Events } from '../../shared/events/event-bus';
import { encrypt, decrypt, generateOTP } from '../../shared/utils/crypto';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/middleware/error.middleware';
import {
  User, UserStatus, UserRole, CountryCode, Currency,
  LoginRequest, RegisterRequest,
} from '../../shared/types';

const BCRYPT_ROUNDS        = 12;
const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES  || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
const MAX_FAILED_LOGINS    = 5;
const LOCK_DURATION_MINS   = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

function countryCurrency(code: CountryCode): Currency {
  const map: Record<CountryCode, Currency> = {
    AE: Currency.AED, SA: Currency.SAR,
    BH: Currency.BHD, KW: Currency.KWD, QA: Currency.QAR,
  };
  return map[code] ?? Currency.AED;
}

function signTokens(user: User): { access_token: string; refresh_token: string } {
  const secret = process.env.JWT_SECRET || 'secret';
  const payload = { sub: user.id, email: decrypt(user.email), role: user.role, status: user.status };

  const access_token  = jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRES } as jwt.SignOptions);
  const refresh_token = jwt.sign({ sub: user.id, type: 'refresh' }, secret, { expiresIn: REFRESH_TOKEN_EXPIRES } as jwt.SignOptions);
  return { access_token, refresh_token };
}

// ── Auth Service ──────────────────────────────────────────────────────────────

export const authService = {
  // ── Register ───────────────────────────────────────────────────────────────
  register: async (body: RegisterRequest) => {
    const encEmail = encrypt(body.email);
    const encPhone = encrypt(body.phone);

    // Duplicate check (FSD §AUTH-003)
    const dup = await db.query<{ id: string }>(
      'SELECT id FROM auth.users WHERE email = $1 OR phone = $2',
      [encEmail, encPhone],
    );
    if (dup.rows.length > 0) {
      // Determine which field conflicts
      const emailRow = await db.query('SELECT id FROM auth.users WHERE email = $1', [encEmail]);
      if (emailRow.rows.length > 0) throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Email address is already registered');
      throw new AppError(409, 'PHONE_ALREADY_EXISTS', 'Phone number is already registered');
    }

    // Validate password strength (FSD §AUTH-004)
    const passRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).{8,128}$/;
    if (!passRegex.test(body.password)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be 8+ chars with uppercase, number and special character');
    }

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const userId       = uuidv4();

    await db.query(
      `INSERT INTO auth.users
        (id, email, phone, password_hash, first_name, last_name, country_code,
         preferred_currency, status, role, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)`,
      [
        userId, encEmail, encPhone, passwordHash,
        body.first_name, body.last_name, body.country_code,
        countryCurrency(body.country_code),
        UserStatus.REGISTERED, UserRole.USER,
      ],
    );

    // Publish domain event (FSD §AUTH-006)
    await eventBus.publish(Events.USER_REGISTERED, {
      user_id:    userId,
      email:      body.email,
      phone:      body.phone,
      first_name: body.first_name,
      country_code: body.country_code,
    });

    logger.info('User registered', { user_id: userId, email: body.email });
    return { user_id: userId, status: UserStatus.REGISTERED, next_step: 'VERIFY_EMAIL_OTP' };
  },

  // ── Login ──────────────────────────────────────────────────────────────────
  login: async (body: LoginRequest, ipAddress?: string) => {
    const encEmail = encrypt(body.email);
    const result   = await db.query<User>(
      `SELECT * FROM auth.users WHERE email = $1 AND is_deleted = false`,
      [encEmail],
    );

    if (result.rows.length === 0) {
      throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password incorrect');
    }

    const user = result.rows[0];

    // Account state checks (FSD §4.1)
    if (user.status === UserStatus.DEACTIVATED) {
      throw new AppError(403, 'AUTH_DEACTIVATED', 'Account has been deactivated');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new AppError(403, 'AUTH_SUSPENDED', 'Account is suspended. Contact support.');
    }

    // Check lockout (FSD §AUTH-012)
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AppError(403, 'AUTH_ACCOUNT_LOCKED', `Account locked. Try again after ${new Date(user.locked_until).toISOString()}`);
    }

    const passwordMatch = await bcrypt.compare(body.password, user.password_hash);
    if (!passwordMatch) {
      const newCount = user.failed_login_count + 1;
      const lockUntil = newCount >= MAX_FAILED_LOGINS
        ? new Date(Date.now() + LOCK_DURATION_MINS * 60_000)
        : null;

      await db.query(
        `UPDATE auth.users SET failed_login_count = $1, locked_until = $2 WHERE id = $3`,
        [newCount, lockUntil, user.id],
      );

      if (lockUntil) {
        // Publish security alert event for notification
        await eventBus.publish('auth.AccountLocked', { user_id: user.id, ip_address: ipAddress });
      }

      throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password incorrect');
    }

    // Reset failed logins on success
    await db.query(
      'UPDATE auth.users SET failed_login_count = 0, locked_until = NULL WHERE id = $1',
      [user.id],
    );

    // If 2FA is enabled, require OTP before issuing tokens (FSD §AUTH-011)
    if (user.two_fa_enabled) {
      const tempToken = uuidv4();
      await redis.setJson(`2fa_pending:${tempToken}`, { user_id: user.id }, 300); // 5 min
      return {
        two_fa_required: true,
        temp_token: tempToken,
        user: { id: user.id, status: user.status, two_fa_required: true },
      };
    }

    const tokens = signTokens(user);
    await redis.setSession(user.id, { user_id: user.id, ip: ipAddress, logged_in_at: new Date() });

    return {
      ...tokens,
      expires_in: 900,
      user: { id: user.id, status: user.status, role: user.role, two_fa_required: false },
    };
  },

  // ── Verify 2FA ─────────────────────────────────────────────────────────────
  verify2FA: async (tempToken: string, code: string) => {
    const pending = await redis.getJson<{ user_id: string }>(`2fa_pending:${tempToken}`);
    if (!pending) throw new AppError(401, 'AUTH_2FA_EXPIRED', '2FA session expired. Please login again.');

    const result = await db.query<User>('SELECT * FROM auth.users WHERE id = $1', [pending.user_id]);
    if (result.rows.length === 0) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const user = result.rows[0];
    const secret = user.two_fa_secret ? decrypt(user.two_fa_secret) : '';

    const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!valid) throw new AppError(403, 'AUTH_2FA_INVALID', 'Invalid 2FA code');

    await redis.del(`2fa_pending:${tempToken}`);
    const tokens = signTokens(user);
    await redis.setSession(user.id, { user_id: user.id, logged_in_at: new Date() });

    return { ...tokens, expires_in: 900, user: { id: user.id, status: user.status, role: user.role } };
  },

  // ── Setup 2FA ──────────────────────────────────────────────────────────────
  setup2FA: async (userId: string) => {
    const result = await db.query<User>('SELECT * FROM auth.users WHERE id = $1', [userId]);
    if (result.rows.length === 0) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const user  = result.rows[0];
    const email = decrypt(user.email);
    const secret = speakeasy.generateSecret({ name: `GCC Bond (${email})`, length: 20 });

    await db.query(
      'UPDATE auth.users SET two_fa_secret = $1 WHERE id = $2',
      [encrypt(secret.base32), userId],
    );

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');
    return { qr_code: qrCodeUrl, manual_key: secret.base32 };
  },

  // ── Enable 2FA after verification ─────────────────────────────────────────
  enable2FA: async (userId: string, code: string) => {
    const result = await db.query<User>('SELECT * FROM auth.users WHERE id = $1', [userId]);
    if (result.rows.length === 0) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const user   = result.rows[0];
    if (!user.two_fa_secret) throw new AppError(400, 'TWO_FA_NOT_SETUP', '2FA not set up yet. Call /auth/2fa/setup first.');

    const secret = decrypt(user.two_fa_secret);
    const valid  = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 });
    if (!valid) throw new AppError(403, 'AUTH_2FA_INVALID', 'Invalid 2FA code. Cannot enable 2FA.');

    await db.query('UPDATE auth.users SET two_fa_enabled = true WHERE id = $1', [userId]);
    return { two_fa_enabled: true };
  },

  // ── Refresh Token ──────────────────────────────────────────────────────────
  refresh: async (refreshToken: string) => {
    let payload: { sub: string; type: string };
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET || 'secret') as typeof payload;
    } catch {
      throw new AppError(401, 'AUTH_REFRESH_INVALID', 'Refresh token invalid or expired. Please login again.');
    }

    if (payload.type !== 'refresh') throw new AppError(401, 'AUTH_REFRESH_INVALID', 'Invalid refresh token type');

    const result = await db.query<User>('SELECT * FROM auth.users WHERE id = $1', [payload.sub]);
    if (result.rows.length === 0) throw new AppError(401, 'AUTH_REFRESH_INVALID', 'User not found');

    const user   = result.rows[0];
    const tokens = signTokens(user);
    return { ...tokens, expires_in: 900 };
  },

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout: async (userId: string, accessToken: string) => {
    // Add token to Redis revocation set (expires when token would naturally expire)
    await redis.set(`revoked:${accessToken.slice(-16)}`, '1', 900);
    await redis.deleteSession(userId);
    return { message: 'Logged out successfully' };
  },

  // ── Password Reset ─────────────────────────────────────────────────────────
  requestPasswordReset: async (email: string) => {
    const encEmail = encrypt(email);
    const result   = await db.query<{ id: string }>('SELECT id FROM auth.users WHERE email = $1', [encEmail]);

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) return { message: 'If this email is registered, you will receive a reset link.' };

    const userId = result.rows[0].id;
    const token  = uuidv4();
    await redis.set(`password_reset:${token}`, userId, 30 * 60); // 30 min (FSD §AUTH-020)

    await eventBus.publish('auth.PasswordResetRequested', { user_id: userId, reset_token: token, email });
    return { message: 'If this email is registered, you will receive a reset link.' };
  },

  resetPassword: async (token: string, newPassword: string) => {
    const userId = await redis.get(`password_reset:${token}`);
    if (!userId) throw new AppError(400, 'RESET_TOKEN_INVALID', 'Reset link is invalid or has expired');

    const passRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*]).{8,128}$/;
    if (!passRegex.test(newPassword)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be 8+ chars with uppercase, number and special character');
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.query('UPDATE auth.users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    await redis.del(`password_reset:${token}`);

    // Revoke all sessions on password change (FSD §AUTH-015)
    await redis.deleteSession(userId);
    await eventBus.publish(Events.PASSWORD_CHANGED, { user_id: userId });

    return { message: 'Password updated successfully' };
  },
};
