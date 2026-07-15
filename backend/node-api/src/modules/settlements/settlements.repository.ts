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
      conditions.push(`st.status = $${i++}`);
      values.push(params.status);
    }
    if (params.userId) {
      conditions.push(`(t.buyer_id = $${i} OR t.seller_id = $${i})`);
      values.push(params.userId);
      i++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Settlement rows only hold trade_id + status/dates; trade economics
    // (bond, quantity, price, parties) come from trading.trades.
    const [rows, countRow] = await Promise.all([
      db.query<Record<string, unknown>>(
        `SELECT st.id, st.trade_id, t.bond_id,
                COALESCE(b.name, '') AS bond_name,
                COALESCE(b.issuer_name, '') AS issuer_name,
                COALESCE(b.isin, '') AS isin,
                t.quantity, t.price,
                t.quantity * t.price AS value,
                t.buyer_id, t.seller_id,
                st.status, st.trade_date, st.settlement_date,
                st.failure_reason, st.created_at
         FROM settlement.settlements st
         JOIN trading.trades  t ON t.id = st.trade_id
         LEFT JOIN bonds.listings b ON b.id = t.bond_id
         ${where}
         ORDER BY st.created_at DESC
         LIMIT $${i} OFFSET $${i + 1}`,
        [...values, params.pageSize, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM settlement.settlements st
         JOIN trading.trades t ON t.id = st.trade_id
         ${where}`,
        values,
      ),
    ]);

    return {
      items: rows.rows.map(r => this.mapRow(r, params.userId)),
      total: parseInt(countRow.rows[0]?.count ?? '0', 10),
    };
  }

  async getStats(userId?: string): Promise<SettlementStats> {
    const condition = userId
      ? `WHERE t.buyer_id = $1 OR t.seller_id = $1`
      : '';
    const values = userId ? [userId] : [];

    const row = await db.query<Record<string, unknown>>(
      `SELECT
         COUNT(*) FILTER (WHERE st.status = 'Pending')                       AS pending,
         COUNT(*) FILTER (WHERE st.status IN ('Processing', 'Reconciling'))  AS processing,
         COUNT(*) FILTER (WHERE st.status = 'Completed')                     AS completed,
         COUNT(*) FILTER (WHERE st.status = 'Failed')                        AS failed,
         COALESCE(SUM(t.quantity * t.price) FILTER (WHERE st.status = 'Completed'), 0) AS total_value
       FROM settlement.settlements st
       JOIN trading.trades t ON t.id = st.trade_id
       ${condition}`,
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

  private mapRow(r: Record<string, unknown>, viewerId?: string): Settlement {
    const buyerId  = String(r['buyer_id']);
    const sellerId = String(r['seller_id']);
    return {
      id:             String(r['id']),
      tradeId:        String(r['trade_id'] ?? r['id']),
      bondId:         String(r['bond_id']),
      bondName:       String(r['bond_name'] ?? ''),
      issuerName:     String(r['issuer_name'] ?? ''),
      isin:           String(r['isin'] ?? ''),
      // Side is relative to the viewer; for admin views (no filter) show Buy
      side:           viewerId && sellerId === viewerId ? 'Sell' : 'Buy',
      quantity:       parseFloat(String(r['quantity'] ?? 0)),
      price:          parseFloat(String(r['price'] ?? 0)),
      value:          parseFloat(String(r['value'] ?? 0)),
      buyerId,
      sellerId,
      status:         r['status'] as Settlement['status'],
      tradeDate:      r['trade_date'] ? new Date(String(r['trade_date'])).toISOString().split('T')[0] : '',
      settlementDate: r['settlement_date'] ? new Date(String(r['settlement_date'])).toISOString().split('T')[0] : '',
      failureReason:  r['failure_reason'] ? String(r['failure_reason']) : null,
      createdAt:      r['created_at'] ? new Date(String(r['created_at'])).toISOString() : '',
    };
  }
}
