import Redis from 'ioredis';
import { config } from '../../config';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Redis client — single instance with typed helpers.
// ---------------------------------------------------------------------------

class RedisClient {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect:          true,
    });

    this.client.on('connect',        () => logger.info('Redis connected'));
    this.client.on('error',  (err)   => logger.error('Redis error', { error: err.message }));
    this.client.on('reconnecting',   () => logger.warn('Redis reconnecting...'));
  }

  // ── Primitive ops ──────────────────────────────────────────────────────────

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const val = await this.client.incr(key);
    if (ttlSeconds && val === 1) await this.client.expire(key, ttlSeconds);
    return val;
  }

  // ── JSON helpers ───────────────────────────────────────────────────────────

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  // ── Session management ────────────────────────────────────────────────────

  setSession<T>(userId: string, data: T): Promise<void> {
    return this.setJson(`session:${userId}`, data, config.redis.ttl.session);
  }

  getSession<T>(userId: string): Promise<T | null> {
    return this.getJson<T>(`session:${userId}`);
  }

  deleteSession(userId: string): Promise<void> {
    return this.del(`session:${userId}`);
  }

  // ── Token revocation (JWT blocklist) ──────────────────────────────────────

  async revokeToken(jti: string, expiresInSeconds: number): Promise<void> {
    await this.set(`revoked:${jti}`, '1', expiresInSeconds);
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    return this.exists(`revoked:${jti}`);
  }

  // ── Failed login tracking (brute-force protection) ────────────────────────

  async incrementFailedLogins(userId: string): Promise<number> {
    return this.incr(`failed_logins:${userId}`, 1_800); // 30-min window
  }

  async resetFailedLogins(userId: string): Promise<void> {
    return this.del(`failed_logins:${userId}`);
  }

  async getFailedLogins(userId: string): Promise<number> {
    const val = await this.get(`failed_logins:${userId}`);
    return val ? parseInt(val, 10) : 0;
  }

  // ── Feature flags ─────────────────────────────────────────────────────────

  async getFeatureFlag(flag: string): Promise<boolean> {
    const val = await this.get(`feature:${flag}`);
    return val === 'true';
  }

  async setFeatureFlag(flag: string, enabled: boolean): Promise<void> {
    await this.set(`feature:${flag}`, String(enabled));
  }

  // ── Sorted sets (order book) ───────────────────────────────────────────────

  zadd(key: string, score: number, member: string): Promise<number | null> {
    return this.client.zadd(key, score, member);
  }

  zrem(key: string, member: string): Promise<number> {
    return this.client.zrem(key, member);
  }

  zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrange(key, start, stop);
  }

  zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrevrange(key, start, stop);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

// Singleton export
export const redis = new RedisClient();
