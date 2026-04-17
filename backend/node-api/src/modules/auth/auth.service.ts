import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import axios from 'axios';

import { config } from '../../config';
import { db }    from '../../core/database/postgres.client';
import { redis } from '../../core/database/redis.client';
import { IEventBus } from '../../core/events/event-bus';
import { EventRoutes } from '../../core/events/event.types';
import { encrypt, hashForLookup } from '../../core/crypto';
import {
  ConflictError, NotFoundError, UnauthorizedError,
  ForbiddenError, ValidationError,
} from '../../core/errors';

import { AuthRepository } from './auth.repository';
import { AuditService }   from '../audit/audit.service';
import {
  RegisterDto, LoginDto, Verify2FADto, Enable2FADto,
  TokenPair, LoginResponse, Require2FAResponse, SafeUser,
  Setup2FAResponse, ResetPasswordDto, OAuthCodeDto, UserRow,
} from './auth.types';

// Provider API response shapes
interface GoogleTokenResponse { access_token: string; id_token: string; }
interface GoogleUserInfo {
  sub: string; email: string; email_verified: boolean;
  given_name: string; family_name: string;
}
interface MicrosoftTokenResponse { access_token: string; id_token: string; }
interface MicrosoftUserInfo {
  id: string; givenName: string; surname: string;
  mail: string | null; userPrincipalName: string;
}

const BCRYPT_ROUNDS = 12;
const MAX_FAILED    = 5;
const LOCK_MINUTES  = 30;

export class AuthService {
  constructor(
    private readonly repo:     AuthRepository,
    private readonly eventBus: IEventBus,
    private readonly audit?:   AuditService,
  ) {}

  // ── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<SafeUser> {
    const emailHash = hashForLookup(dto.email);

    const existing = await this.repo.findByEmailHash(emailHash);
    if (existing) throw new ConflictError('An account with this email already exists');

    const [passwordHash, encryptedEmail, encryptedPhone] = await Promise.all([
      bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      Promise.resolve(encrypt(dto.email)),
      Promise.resolve(encrypt(dto.phone)),
    ]);

    const user = await this.repo.create({
      email:             encryptedEmail,
      emailHash,
      phone:             encryptedPhone,
      passwordHash,
      firstName:         dto.firstName,
      lastName:          dto.lastName,
      nationality:       dto.nationality,
      dateOfBirth:       dto.dateOfBirth,
      preferredCurrency: dto.currency ?? 'AED',
    });

    await this.eventBus.publish(EventRoutes.USER_REGISTERED, {
      user_id:    user.id,
      email:      dto.email,
      first_name: dto.firstName,
    });

    return this.toSafeUser(user);
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<LoginResponse | Require2FAResponse> {
    const emailHash = hashForLookup(dto.email);
    const user      = await this.repo.findByEmailHash(emailHash);

    if (!user) throw new UnauthorizedError('Invalid email or password');

    // Check account lock
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      throw new ForbiddenError(
        `Account locked. Try again after ${new Date(user.locked_until).toISOString()}`,
      );
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordMatch) {
      await this.repo.incrementFailedLogins(user.id);
      const fails = (user.failed_login_count ?? 0) + 1;
      if (fails >= MAX_FAILED) {
        await this.repo.lockUntil(
          user.id,
          new Date(Date.now() + LOCK_MINUTES * 60_000),
        );
        throw new ForbiddenError(`Account locked for ${LOCK_MINUTES} minutes after ${MAX_FAILED} failed attempts`);
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === 'SUSPENDED') throw new ForbiddenError('Account suspended');
    if (user.status === 'DEACTIVATED') throw new ForbiddenError('Account deactivated');

    await this.repo.updateLastLogin(user.id);
    this.audit?.log({ event_type: 'USER_LOGGED_IN', actor_id: user.id }).catch(() => {});

    // 2FA step-up
    if (user.totp_enabled) {
      const tempToken = jwt.sign(
        { sub: user.id, type: 'temp_2fa' },
        config.jwt.secret,
        { expiresIn: '5m' as any },
      );
      return { requires2FA: true, tempToken };
    }

    return {
      ...this.issueTokenPair(user),
      user: this.toSafeUser(user),
    };
  }

  // ── 2FA Verification ───────────────────────────────────────────────────────

  async verify2FA(dto: Verify2FADto): Promise<LoginResponse> {
    let payload: { sub: string; type: string };
    try {
      payload = jwt.verify(dto.tempToken, config.jwt.secret) as typeof payload;
    } catch {
      throw new UnauthorizedError('Invalid or expired temp token');
    }

    if (payload.type !== 'temp_2fa') throw new UnauthorizedError('Invalid token type');

    const user = await this.repo.findById(payload.sub);
    if (!user || !user.totp_secret) throw new NotFoundError('User');

    const valid = speakeasy.totp.verify({
      secret:   user.totp_secret,
      encoding: 'base32',
      token:    dto.totpCode,
      window:   1,
    });
    if (!valid) throw new UnauthorizedError('Invalid 2FA code');

    return { ...this.issueTokenPair(user), user: this.toSafeUser(user) };
  }

  // ── 2FA Setup ──────────────────────────────────────────────────────────────

  async setup2FA(userId: string): Promise<Setup2FAResponse> {
    const user   = await this.repo.findById(userId);
    if (!user) throw new NotFoundError('User');

    const secret = speakeasy.generateSecret({ name: `GCC Bond (${user.first_name})`, length: 20 });

    await this.repo.saveTotpSecret(userId, secret.base32);

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
    return { secret: secret.base32, qrCodeUrl };
  }

  async enable2FA(userId: string, dto: Enable2FADto): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user || !user.totp_secret) throw new NotFoundError('User');

    const valid = speakeasy.totp.verify({
      secret:   user.totp_secret,
      encoding: 'base32',
      token:    dto.totpCode,
      window:   1,
    });
    if (!valid) throw new ValidationError('Invalid TOTP code — cannot enable 2FA');

    await this.repo.enableTotp(userId);
  }

  // ── Token Refresh ──────────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; jti: string; type: string };
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as typeof payload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedError('Invalid token type');

    const revoked = await redis.isTokenRevoked(payload.jti);
    if (revoked) throw new UnauthorizedError('Refresh token revoked');

    const user = await this.repo.findById(payload.sub);
    if (!user) throw new NotFoundError('User');

    return this.issueTokenPair(user);
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(accessToken: string): Promise<void> {
    try {
      const payload = jwt.decode(accessToken) as { jti?: string; exp?: number };
      if (payload?.jti && payload?.exp) {
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) await redis.revokeToken(payload.jti, ttl);
      }
    } catch {
      // best-effort
    }
  }

  // ── Password Reset ─────────────────────────────────────────────────────────

  async requestPasswordReset(email: string): Promise<void> {
    const emailHash = hashForLookup(email);
    const user      = await this.repo.findByEmailHash(emailHash);
    // Silent success regardless — prevent user enumeration
    if (!user) return;

    const token     = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60_000); // 1 hour

    await this.repo.savePasswordResetToken(user.id, tokenHash, expiresAt);

    // In production publish to event bus to send email via notifications service
    await this.eventBus.publish('user.password-reset-requested', {
      user_id: user.id,
      token,
      email,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const record    = await this.repo.findPasswordReset(tokenHash);

    if (!record || record.used || new Date() > new Date(record.expires_at)) {
      throw new ValidationError('Reset token is invalid or has expired');
    }

    const hash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await db.transaction(async (client) => {
      await this.repo.savePasswordHash(record.user_id, hash, client);
      await this.repo.markPasswordResetUsed(tokenHash);
    });

    // Revoke all existing sessions for security
    await redis.deleteSession(record.user_id);
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  async loginWithGoogle(dto: OAuthCodeDto): Promise<LoginResponse> {
    if (!config.google.clientId) throw new ValidationError('Google OAuth is not configured');

    const params = new URLSearchParams({
      grant_type:    'authorization_code',
      code:          dto.code,
      client_id:     config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri:  dto.redirectUri,
      code_verifier: dto.codeVerifier,
    });

    let accessToken: string;
    try {
      const tokenRes = await axios.post<GoogleTokenResponse>(
        'https://oauth2.googleapis.com/token',
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      accessToken = tokenRes.data.access_token;
    } catch {
      throw new UnauthorizedError('Google authentication failed — invalid or expired code');
    }

    const { data: info } = await axios.get<GoogleUserInfo>(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!info.email) throw new UnauthorizedError('Google account has no verified email');
    return this.findOrCreateOAuthUser({
      email:          info.email,
      firstName:      info.given_name  ?? 'User',
      lastName:       info.family_name ?? '',
      provider:       'google',
      providerUserId: info.sub,
    });
  }

  // ── Microsoft OAuth ────────────────────────────────────────────────────────

  async loginWithMicrosoft(dto: OAuthCodeDto): Promise<LoginResponse> {
    if (!config.microsoft.clientId) throw new ValidationError('Microsoft OAuth is not configured');

    const params = new URLSearchParams({
      grant_type:    'authorization_code',
      code:          dto.code,
      client_id:     config.microsoft.clientId,
      client_secret: config.microsoft.clientSecret,
      redirect_uri:  dto.redirectUri,
      code_verifier: dto.codeVerifier,
      scope:         'openid profile email User.Read',
    });

    let msAccessToken: string;
    try {
      const tokenRes = await axios.post<MicrosoftTokenResponse>(
        `https://login.microsoftonline.com/${config.microsoft.tenantId}/oauth2/v2.0/token`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      msAccessToken = tokenRes.data.access_token;
    } catch {
      throw new UnauthorizedError('Microsoft authentication failed — invalid or expired code');
    }

    const { data: info } = await axios.get<MicrosoftUserInfo>(
      'https://graph.microsoft.com/v1.0/me',
      { headers: { Authorization: `Bearer ${msAccessToken}` } },
    );

    const email = info.mail ?? info.userPrincipalName;
    if (!email) throw new UnauthorizedError('Microsoft account has no email');

    return this.findOrCreateOAuthUser({
      email,
      firstName:      info.givenName ?? 'User',
      lastName:       info.surname   ?? '',
      provider:       'microsoft',
      providerUserId: info.id,
    });
  }

  // ── OAuth shared: find or provision user ───────────────────────────────────

  private async findOrCreateOAuthUser(params: {
    email:          string;
    firstName:      string;
    lastName:       string;
    provider:       string;
    providerUserId: string;
  }): Promise<LoginResponse> {
    const emailHash = hashForLookup(params.email);
    let user = await this.repo.findByEmailHash(emailHash);

    if (!user) {
      const [encryptedEmail, encryptedPhone, passwordHash] = await Promise.all([
        Promise.resolve(encrypt(params.email)),
        Promise.resolve(encrypt('+000000000')),
        bcrypt.hash(uuidv4(), 4),
      ]);

      user = await this.repo.create({
        email:             encryptedEmail,
        emailHash,
        phone:             encryptedPhone,
        passwordHash,
        firstName:         params.firstName,
        lastName:          params.lastName || params.firstName,
        nationality:       'XX',
        dateOfBirth:       '2000-01-01',
        preferredCurrency: 'AED',
      });

      this.eventBus.publish(EventRoutes.USER_REGISTERED, {
        user_id:    user.id,
        email:      params.email,
        first_name: params.firstName,
      }).catch(() => {});
    }

    if (user.status === 'SUSPENDED')   throw new ForbiddenError('Account suspended');
    if (user.status === 'DEACTIVATED') throw new ForbiddenError('Account deactivated');

    await this.repo.updateLastLogin(user.id);
    this.audit?.log({
      event_type:  'OAUTH_LOGIN',
      action:      'login',
      actor_id:    user.id,
      target_id:   user.id,
      target_type: 'USER',
      metadata:    { provider: params.provider },
    }).catch(() => {});

    return { ...this.issueTokenPair(user), user: this.toSafeUser(user) };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private issueTokenPair(user: UserRow): TokenPair {
    const jtiAccess  = uuidv4();
    const jtiRefresh = uuidv4();

    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, status: user.status, jti: jtiAccess },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as any },
    );

    const refreshToken = jwt.sign(
      { sub: user.id, jti: jtiRefresh, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpires as any },
    );

    return { accessToken, refreshToken };
  }

  private toSafeUser(user: UserRow): SafeUser {
    return {
      id:        user.id,
      email:     user.email,
      firstName: user.first_name,
      lastName:  user.last_name,
      role:      user.role,
      status:    user.status,
    };
  }
}
