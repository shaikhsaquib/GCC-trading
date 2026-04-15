import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

pool.on('connect', () => logger.debug('PostgreSQL: new connection established'));
pool.on('error', (err) => logger.error('PostgreSQL pool error', { error: err.message }));

export const db = {
  /**
   * Run a single query on the pool.
   */
  query: async <T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
    const start = Date.now();
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 200) {
      logger.warn('Slow query detected', { query: text.slice(0, 80), duration });
    }
    return result;
  },

  /**
   * Acquire a client for multi-statement transactions.
   * Always call client.release() in a finally block.
   */
  getClient: (): Promise<PoolClient> => pool.connect(),

  /**
   * Helper: run multiple statements in a single ACID transaction.
   */
  transaction: async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /** Health check */
  healthCheck: async (): Promise<boolean> => {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  },

  /** Graceful shutdown */
  close: (): Promise<void> => pool.end(),
};

export type Db = typeof db;
