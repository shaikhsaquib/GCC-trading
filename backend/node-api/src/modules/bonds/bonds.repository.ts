import { db } from '../../core/database/postgres.client';
import { Bond } from './bonds.types';

export interface BondSearchFilter {
  search?:   string;
  status?:   string;
  type?:     string;
  page:      number;
  pageSize:  number;
}

export class BondsRepository {
  async search(f: BondSearchFilter): Promise<{ items: Bond[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[]    = [];
    let   idx = 1;

    if (f.status) {
      conditions.push(`status = $${idx++}`);
      params.push(f.status);
    }
    if (f.type) {
      conditions.push(`issuer_type = $${idx++}`);
      params.push(f.type);
    }
    if (f.search) {
      conditions.push(
        `(name ILIKE $${idx} OR isin ILIKE $${idx} OR issuer_name ILIKE $${idx})`,
      );
      params.push(`%${f.search}%`);
      idx++;
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit  = Math.min(f.pageSize, 100);
    const offset = (f.page - 1) * limit;

    const [rows, count] = await Promise.all([
      db.query<Record<string, unknown>>(
        `SELECT id, isin, name, issuer_name, issuer_type, currency,
                face_value, coupon_rate, coupon_frequency, maturity_date,
                credit_rating, is_sharia_compliant, min_investment,
                current_price, status
         FROM bonds.listings ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM bonds.listings ${where}`,
        params,
      ),
    ]);

    return {
      items: rows.rows.map(this.mapRow),
      total: parseInt(count.rows[0]?.count ?? '0', 10),
    };
  }

  async findById(id: string): Promise<Bond | null> {
    const r = await db.query<Record<string, unknown>>(
      `SELECT id, isin, name, issuer_name, issuer_type, currency,
              face_value, coupon_rate, coupon_frequency, maturity_date,
              credit_rating, is_sharia_compliant, min_investment,
              current_price, status
       FROM bonds.listings WHERE id = $1`,
      [id],
    );
    return r.rows[0] ? this.mapRow(r.rows[0]) : null;
  }

  private mapRow(row: Record<string, unknown>): Bond {
    const maturity = row['maturity_date'];
    const maturityStr =
      maturity instanceof Date
        ? maturity.toISOString().split('T')[0]
        : String(maturity ?? '');

    return {
      id:                String(row['id'] ?? ''),
      isin:              String(row['isin'] ?? ''),
      name:              String(row['name'] ?? ''),
      issuerName:        String(row['issuer_name'] ?? ''),
      issuerType:        String(row['issuer_type'] ?? '') as Bond['issuerType'],
      currency:          String(row['currency'] ?? 'AED'),
      faceValue:         parseFloat(String(row['face_value'] ?? 0)),
      couponRate:        parseFloat(String(row['coupon_rate'] ?? 0)),
      couponFrequency:   String(row['coupon_frequency'] ?? '') as Bond['couponFrequency'],
      maturityDate:      maturityStr,
      creditRating:      String(row['credit_rating'] ?? ''),
      isShariaCompliant: Boolean(row['is_sharia_compliant']),
      minInvestment:     parseFloat(String(row['min_investment'] ?? 0)),
      currentPrice:      parseFloat(String(row['current_price'] ?? 0)),
      status:            String(row['status'] ?? 'Active') as Bond['status'],
    };
  }
}
