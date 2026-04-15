import { db } from '../../core/database/postgres.client';
import { DashboardStats, UserListFilter } from './admin.types';

export class AdminRepository {
  async getDashboardStats(): Promise<DashboardStats> {
    const [users, kyc, bonds, orders, trades] = await Promise.all([
      db.query<{ total: string; active: string }>(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active
        FROM auth.users`),
      db.query<{ pending: string }>(`
        SELECT COUNT(*) AS pending FROM kyc.submissions WHERE status IN ('Submitted','UnderReview')`),
      db.query<{ total: string }>(`
        SELECT COUNT(*) AS total FROM bonds.listings WHERE status = 'Active'`),
      db.query<{ open: string }>(`
        SELECT COUNT(*) AS open FROM trading.orders WHERE status IN ('Open','PartiallyFilled')`),
      db.query<{ count: string; volume: string }>(`
        SELECT COUNT(*) AS count, COALESCE(SUM(quantity * price), 0) AS volume
        FROM trading.trades WHERE executed_at >= NOW()::date`),
    ]);

    return {
      totalUsers:       parseInt(users.rows[0].total,  10),
      activeUsers:      parseInt(users.rows[0].active, 10),
      pendingKyc:       parseInt(kyc.rows[0].pending,  10),
      totalBonds:       parseInt(bonds.rows[0].total,  10),
      openOrders:       parseInt(orders.rows[0].open,  10),
      tradesToday:      parseInt(trades.rows[0].count,  10),
      tradeVolumeToday: parseFloat(trades.rows[0].volume),
    };
  }

  async listUsers(filter: UserListFilter): Promise<{ data: unknown[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[]    = [];
    let   idx = 1;

    if (filter.status) { conditions.push(`status = $${idx++}`);  params.push(filter.status); }
    if (filter.role)   { conditions.push(`role = $${idx++}`);    params.push(filter.role); }
    if (filter.search) {
      conditions.push(`(name_normalized ILIKE $${idx} OR email_hash = $${idx+1})`);
      params.push(`%${filter.search.toLowerCase()}%`, filter.search);
      idx += 2;
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = filter.limit  ?? 20;
    const offset = filter.offset ?? 0;

    const [rows, count] = await Promise.all([
      db.query(
        `SELECT id, first_name, last_name, role, status, nationality,
                preferred_currency, created_at, last_login_at
         FROM auth.users ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...params, limit, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM auth.users ${where}`,
        params,
      ),
    ]);

    return { data: rows.rows, total: parseInt(count.rows[0].count, 10) };
  }

  async updateUserStatus(id: string, status: string): Promise<void> {
    await db.query(
      "UPDATE auth.users SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, id],
    );
  }

  async getDailyReport(): Promise<unknown[]> {
    const r = await db.query(`
      SELECT
        DATE(executed_at)          AS trade_date,
        COUNT(*)                   AS trade_count,
        SUM(quantity * price)      AS trade_volume,
        SUM(buyer_fee + seller_fee + settlement_fee) AS total_fees,
        COUNT(DISTINCT buyer_id)   AS unique_buyers,
        COUNT(DISTINCT seller_id)  AS unique_sellers
      FROM trading.trades
      WHERE executed_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1 DESC`);
    return r.rows;
  }
}
