import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../../config';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// PostgreSQL connection pool — single instance shared across the app.
// ---------------------------------------------------------------------------

class PostgresClient {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      min:              config.database.poolMin,
      max:              config.database.poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: { rejectUnauthorized: false },
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', { error: err.message });
    });
  }

  /** Execute a single query. */
  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const result = await this.pool.query<T>(sql, params);
    const duration = Date.now() - start;

    if (duration > 200) {
      logger.warn('Slow query detected', { sql: sql.substring(0, 80), duration });
    }

    return result;
  }

  /** Acquire a raw client for manual transaction management. */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Run `work` inside an ACID transaction.
   * Commits on success, rolls back on any thrown error.
   */
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Singleton export
export const db = new PostgresClient();
