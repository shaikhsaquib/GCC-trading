import { db } from '../../core/database/postgres.client';
import { Settlement, SettlementStats } from './settlements.types';

export class SettlementsRepository {
  async findAll(params: {
    userId?:  string;
    status?:  string;
    page:     number;
    pageSize: number;
  }): Promise<{ items: Settlement[]; total: number }> {
    const offset = (params.page - 1) * params.pageSize;
    const conditions: string[] = [];
    const values: unknown[]    = [];
    let   i = 1;

    if (params.status) {
      conditions.push(`s.status = $${i++}`);
      values.push(params.status);
    }
    if (params.userId) {
      conditions.push(`(s.buyer_id = $${i++} OR s.seller_id = $${i++})`);
      values.push(params.userId, params.userId);
      i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRow] = await Promise.all([
      db.query<Record<string, unknown>>(
        `SELECT s.id, s.trade_id, s.bond_id,
                COALESCE(b.name, '') AS bond_name,
                COALESCE(b.isin, '') AS isin,
                s.side, s.quantity, s.price,
                s.quantity * s.price AS value,
                s.buyer_id, s.seller_id,
                s.status, s.trade_date, s.settlement_date,
                s.failure_reason, s.created_at
         FROM trading.settlements s
         LEFT JOIN bonds.listings b ON b.id = s.bond_id
         ${where}
         ORDER BY s.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...values, params.pageSize, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM trading.settlements s ${where}`,
        values,
      ),
    ]);

    return {
      items: rows.rows.map(this.mapRow),
      total: parseInt(countRow.rows[0]?.count ?? '0', 10),
    };
  }

  async getStats(userId?: string): Promise<SettlementStats> {
    const condition = userId
      ? `WHERE buyer_id = $1 OR seller_id = $1`
      : '';
    const values = userId ? [userId] : [];

    const row = await db.query<Record<string, unknown>>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'Pending')    AS pending,
         COUNT(*) FILTER (WHERE status = 'Processing') AS processing,
         COUNT(*) FILTER (WHERE status = 'Settled')    AS completed,
         COUNT(*) FILTER (WHERE status = 'Failed')     AS failed,
         COALESCE(SUM(quantity * price) FILTER (WHERE status = 'Settled'), 0) AS total_value
       FROM trading.settlements ${condition}`,
      values,
    );

    const r = row.rows[0] ?? {};
    return {
      pending:    parseInt(String(r['pending'] ?? 0), 10),
      processing: parseInt(String(r['processing'] ?? 0), 10),
      completed:  parseInt(String(r['completed'] ?? 0), 10),
      failed:     parseInt(String(r['failed'] ?? 0), 10),
      totalValue: parseFloat(String(r['total_value'] ?? 0)),
    };
  }

  private mapRow(r: Record<string, unknown>): Settlement {
    return {
      id:             String(r['id']),
      tradeId:        String(r['trade_id'] ?? r['id']),
      bondId:         String(r['bond_id']),
      bondName:       String(r['bond_name'] ?? ''),
      isin:           String(r['isin'] ?? ''),
      side:           r['side'] as 'Buy' | 'Sell',
      quantity:       Number(r['quantity']),
      price:          parseFloat(String(r['price'])),
      value:          parseFloat(String(r['value'])),
      buyerId:        String(r['buyer_id']),
      sellerId:       String(r['seller_id']),
      status:         r['status'] as Settlement['status'],
      tradeDate:      r['trade_date'] ? new Date(String(r['trade_date'])).toISOString().split('T')[0] : '',
      settlementDate: r['settlement_date'] ? new Date(String(r['settlement_date'])).toISOString().split('T')[0] : '',
      failureReason:  r['failure_reason'] ? String(r['failure_reason']) : null,
      createdAt:      r['created_at'] ? new Date(String(r['created_at'])).toISOString() : '',
    };
  }
}
