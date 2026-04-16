import { db } from '../../core/database/postgres.client';
import { PortfolioHolding } from './portfolio.types';

export class PortfolioRepository {
  async findHoldingsByUser(userId: string): Promise<PortfolioHolding[]> {
    const r = await db.query<Record<string, unknown>>(
      `SELECT h.id,
              h.bond_id,
              b.name              AS bond_name,
              b.isin,
              h.quantity,
              h.avg_buy_price,
              h.current_value,
              h.unrealized_pnl,
              h.total_coupon_received
       FROM portfolio.holdings h
       JOIN bonds.listings b ON b.id = h.bond_id
       WHERE h.user_id = $1
       ORDER BY h.updated_at DESC`,
      [userId],
    );

    return r.rows.map(this.mapHoldingRow);
  }

  private mapHoldingRow(row: Record<string, unknown>): PortfolioHolding {
    return {
      id:                  String(row['id'] ?? ''),
      bondId:              String(row['bond_id'] ?? ''),
      bondName:            String(row['bond_name'] ?? ''),
      isin:                String(row['isin'] ?? ''),
      quantity:            parseFloat(String(row['quantity'] ?? 0)),
      avgBuyPrice:         parseFloat(String(row['avg_buy_price'] ?? 0)),
      currentValue:        parseFloat(String(row['current_value'] ?? 0)),
      unrealizedPnl:       parseFloat(String(row['unrealized_pnl'] ?? 0)),
      totalCouponReceived: parseFloat(String(row['total_coupon_received'] ?? 0)),
    };
  }
}
