import { db } from '../../core/database/postgres.client';
import { PortfolioHolding, HoldingCalendarRow } from './portfolio.types';

export class PortfolioRepository {
  async findHoldingsByUser(userId: string): Promise<PortfolioHolding[]> {
    const r = await db.query<Record<string, unknown>>(
      `SELECT h.id,
              h.bond_id,
              b.name                AS bond_name,
              b.isin,
              h.quantity,
              h.avg_buy_price,
              h.current_value,
              h.unrealized_pnl,
              h.total_coupon_received,
              b.issuer_name,
              b.issuer_type,
              b.coupon_rate,
              b.maturity_date,
              b.current_price,
              b.credit_rating,
              b.is_sharia_compliant
       FROM portfolio.holdings h
       JOIN bonds.listings b ON b.id = h.bond_id
       WHERE h.user_id = $1
       ORDER BY h.updated_at DESC`,
      [userId],
    );

    return r.rows.map(this.mapHoldingRow);
  }

  async findCouponCalendarData(userId: string): Promise<HoldingCalendarRow[]> {
    const r = await db.query<Record<string, unknown>>(
      `SELECT h.bond_id,
              b.name             AS bond_name,
              b.isin,
              b.coupon_rate,
              b.coupon_frequency,
              b.maturity_date,
              b.face_value,
              h.quantity
       FROM portfolio.holdings h
       JOIN bonds.listings b ON b.id = h.bond_id
       WHERE h.user_id = $1`,
      [userId],
    );
    return r.rows.map(row => ({
      bondId:          String(row['bond_id'] ?? ''),
      bondName:        String(row['bond_name'] ?? ''),
      isin:            String(row['isin'] ?? ''),
      couponRate:      parseFloat(String(row['coupon_rate'] ?? 0)),
      couponFrequency: String(row['coupon_frequency'] ?? 'Annual'),
      maturityDate:    String(row['maturity_date'] ?? ''),
      faceValue:       parseFloat(String(row['face_value'] ?? 100)),
      quantity:        parseFloat(String(row['quantity'] ?? 0)),
    }));
  }

  private mapHoldingRow(row: Record<string, unknown>): PortfolioHolding {
    const maturity = row['maturity_date'];
    const maturityStr = maturity instanceof Date
      ? maturity.toISOString().split('T')[0]
      : String(maturity ?? '');
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
      issuerName:          String(row['issuer_name'] ?? ''),
      issuerType:          String(row['issuer_type'] ?? ''),
      couponRate:          parseFloat(String(row['coupon_rate'] ?? 0)),
      maturityDate:        maturityStr,
      currentPrice:        parseFloat(String(row['current_price'] ?? 0)),
      creditRating:        String(row['credit_rating'] ?? ''),
      isShariaCompliant:   Boolean(row['is_sharia_compliant']),
    };
  }
}
