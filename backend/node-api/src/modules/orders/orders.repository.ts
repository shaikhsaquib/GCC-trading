import crypto from 'crypto';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { db } from '../../core/database/postgres.client';
import { Order, PlaceOrderInput, OrderBookEntry } from './orders.types';

type Queryable = { query<T extends QueryResultRow = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> };

export class OrdersRepository {
  async create(userId: string, input: PlaceOrderInput): Promise<Order> {
    const idempotencyKey = crypto.randomUUID();

    const r = await db.query<Record<string, unknown>>(
      `INSERT INTO trading.orders
         (user_id, bond_id, side, order_type, quantity, filled_quantity,
          price, avg_fill_price, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, 0, $6, NULL, 'Open', $7)
       RETURNING id, user_id, bond_id, side, order_type, quantity,
                 filled_quantity, price, avg_fill_price, status, created_at`,
      [
        userId,
        input.bondId,
        input.side,
        input.orderType,
        input.quantity,
        input.price ?? null,
        idempotencyKey,
      ],
    );

    return this.mapRow(r.rows[0]!);
  }

  async findByUser(
    userId: string,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<Order[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[]    = [userId];
    let   idx = 2;

    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const r = await db.query<Record<string, unknown>>(
      `SELECT id, user_id, bond_id, side, order_type, quantity,
              filled_quantity, price, avg_fill_price, status, created_at
       FROM trading.orders ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return r.rows.map(this.mapRow);
  }

  async cancel(orderId: string, userId: string, client?: PoolClient): Promise<Order | null> {
    const q: Queryable = client ?? db;
    const r = await q.query<Record<string, unknown>>(
      `UPDATE trading.orders
       SET status = 'Cancelled', cancel_reason = 'User requested', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('Open', 'PendingValidation', 'PartiallyFilled')
       RETURNING id, user_id, bond_id, side, order_type, quantity,
                 filled_quantity, price, avg_fill_price, status, created_at`,
      [orderId, userId],
    );

    return r.rows[0] ? this.mapRow(r.rows[0]) : null;
  }

  async findByIdAndUser(orderId: string, userId: string): Promise<Order | null> {
    const r = await db.query<Record<string, unknown>>(
      `SELECT id, user_id, bond_id, side, order_type, quantity,
              filled_quantity, price, avg_fill_price, status, created_at
       FROM trading.orders
       WHERE id = $1 AND user_id = $2`,
      [orderId, userId],
    );

    return r.rows[0] ? this.mapRow(r.rows[0]) : null;
  }

  async getOrderBook(
    bondId: string,
    depth: number,
  ): Promise<{ bids: OrderBookEntry[]; asks: OrderBookEntry[] }> {
    const [bidsResult, asksResult] = await Promise.all([
      db.query<Record<string, unknown>>(
        `SELECT price,
                SUM(quantity - filled_quantity) AS quantity,
                COUNT(*)                         AS order_count
         FROM trading.orders
         WHERE bond_id = $1
           AND side   = 'Buy'
           AND status IN ('Open', 'PartiallyFilled')
         GROUP BY price
         ORDER BY price DESC
         LIMIT $2`,
        [bondId, depth],
      ),
      db.query<Record<string, unknown>>(
        `SELECT price,
                SUM(quantity - filled_quantity) AS quantity,
                COUNT(*)                         AS order_count
         FROM trading.orders
         WHERE bond_id = $1
           AND side   = 'Sell'
           AND status IN ('Open', 'PartiallyFilled')
         GROUP BY price
         ORDER BY price ASC
         LIMIT $2`,
        [bondId, depth],
      ),
    ]);

    const mapEntry = (row: Record<string, unknown>): OrderBookEntry => ({
      price:      parseFloat(String(row['price'] ?? 0)),
      quantity:   parseFloat(String(row['quantity'] ?? 0)),
      orderCount: parseInt(String(row['order_count'] ?? 0), 10),
    });

    return {
      bids: bidsResult.rows.map(mapEntry),
      asks: asksResult.rows.map(mapEntry),
    };
  }

  private mapRow(row: Record<string, unknown>): Order {
    const createdAt = row['created_at'];
    const createdAtStr =
      createdAt instanceof Date
        ? createdAt.toISOString()
        : String(createdAt ?? '');

    const price        = row['price']          != null ? parseFloat(String(row['price']))           : null;
    const avgFillPrice = row['avg_fill_price'] != null ? parseFloat(String(row['avg_fill_price']))  : null;

    return {
      id:             String(row['id'] ?? ''),
      userId:         String(row['user_id'] ?? ''),
      bondId:         String(row['bond_id'] ?? ''),
      side:           String(row['side'] ?? '') as Order['side'],
      orderType:      String(row['order_type'] ?? '') as Order['orderType'],
      quantity:       parseFloat(String(row['quantity'] ?? 0)),
      filledQuantity: parseFloat(String(row['filled_quantity'] ?? 0)),
      price,
      avgFillPrice,
      status:         String(row['status'] ?? ''),
      createdAt:      createdAtStr,
    };
  }
}
