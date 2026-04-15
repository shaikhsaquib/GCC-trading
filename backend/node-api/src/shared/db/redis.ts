import Redis from 'ioredis';
import { logger } from '../utils/logger';

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: false,
});

redisClient.on('connect',  () => logger.info('Redis: connected'));
redisClient.on('error',    (err) => logger.error('Redis error', { error: err.message }));
redisClient.on('reconnecting', () => logger.warn('Redis: reconnecting...'));

export const redis = {
  client: redisClient,

  // ── Key-Value ──────────────────────────────────────────────────────────────

  set: (key: string, value: string, ttlSeconds?: number): Promise<string | null> => {
    if (ttlSeconds) return redisClient.set(key, value, 'EX', ttlSeconds);
    return redisClient.set(key, value);
  },

  get: (key: string): Promise<string | null> => redisClient.get(key),

  del: (...keys: string[]): Promise<number> => redisClient.del(...keys),

  exists: (key: string): Promise<number> => redisClient.exists(key),

  expire: (key: string, ttl: number): Promise<number> => redisClient.expire(key, ttl),

  ttl: (key: string): Promise<number> => redisClient.ttl(key),

  // ── JSON helpers ───────────────────────────────────────────────────────────

  setJson: <T>(key: string, value: T, ttlSeconds?: number): Promise<string | null> =>
    redis.set(key, JSON.stringify(value), ttlSeconds),

  getJson: async <T>(key: string): Promise<T | null> => {
    const raw = await redisClient.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },

  // ── Counters (rate limiting, failed logins) ────────────────────────────────

  incr: (key: string): Promise<number> => redisClient.incr(key),

  incrWithTTL: async (key: string, ttlSeconds: number): Promise<number> => {
    const pipeline = redisClient.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, ttlSeconds);
    const results = await pipeline.exec();
    return (results?.[0]?.[1] as number) ?? 0;
  },

  // ── Order Book (Sorted Sets) ───────────────────────────────────────────────

  /** Add order to order book: price as score, orderId as member */
  zadd: (key: string, score: number, member: string): Promise<number> =>
    redisClient.zadd(key, score, member),

  zrem: (key: string, member: string): Promise<number> =>
    redisClient.zrem(key, member),

  /** Best BUY: highest price first */
  zrevrange: (key: string, start: number, stop: number): Promise<string[]> =>
    redisClient.zrevrange(key, start, stop),

  /** Best SELL: lowest price first */
  zrange: (key: string, start: number, stop: number): Promise<string[]> =>
    redisClient.zrange(key, start, stop),

  // ── Sessions ───────────────────────────────────────────────────────────────

  setSession: (userId: string, sessionData: unknown) =>
    redis.setJson(`session:${userId}`, sessionData, 7 * 24 * 3600),

  getSession: <T>(userId: string) =>
    redis.getJson<T>(`session:${userId}`),

  deleteSession: (userId: string) =>
    redis.del(`session:${userId}`),

  // ── Feature Flags ──────────────────────────────────────────────────────────

  getFeatureFlag: async (flag: string): Promise<boolean> => {
    const val = await redisClient.get(`feature:${flag}`);
    return val !== 'false';
  },

  setFeatureFlag: (flag: string, enabled: boolean) =>
    redis.set(`feature:${flag}`, String(enabled)),

  // ── Health ─────────────────────────────────────────────────────────────────

  healthCheck: async (): Promise<boolean> => {
    try {
      await redisClient.ping();
      return true;
    } catch {
      return false;
    }
  },

  close: (): Promise<string> => redisClient.quit(),
};
