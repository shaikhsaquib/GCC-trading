import crypto from 'crypto';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { db } from '../../core/database/postgres.client';
import { Order, PlaceOrderInput, OrderBookEntry, TradeRecord } from './orders.types';

type Queryable = { query<T extends QueryResultRow = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> };

export class OrdersRepository {
  async create(userId: string, input: PlaceOrderInput, client?: PoolClient): Promise<Order> {
    const q: Queryable = client ?? db;
    const idempotencyKey = crypto.randomUUID();

    const r = await q.query<Record<string, unknown>>(
      `INSERT INTO trading.orders
         (user_id, bond_id, side, order_type, quantity, filled_quantity,
          price, avg_fill_price, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, 0, $6, NULL, 'Open', $7)
       RETURNING id, user_id, bond_id, side, order_type, quantity,
                 filled_quantity, price, avg_fill_price, status, created_at`,
      [userId, input.bondId, input.side, input.orderType, input.quantity, input.price ?? null, idempotencyKey],
    );

    return this.mapRow(r.rows[0]!);
  }

  async findById(orderId: string): Promise<Order | null> {
    const r = await db.query<Record<string, unknown>>(
      `SELECT id, user_id, bond_id, side, order_type, quantity,
              filled_quantity, price, avg_fill_price, status, created_at
       FROM trading.orders WHERE id = $1`,
      [orderId],
    );
    return r.rows[0] ? this.mapRow(r.rows[0]) : null;
  }

  /**
   * Find the best-priced, earliest-time counterparty order for matching.
   * Uses FOR UPDATE SKIP LOCKED so concurrent matching runs on the same bond
   * never deadlock — each run grabs a different counterparty.
   * Must be called inside an active transaction.
   */
  async findBestCounterparty(incoming: Order, client: PoolClient): Promise<Order | null> {
    const counterSide = incoming.side === 'Buy' ? 'Sell' : 'Buy';
    const r = await client.query<Record<string, unknown>>(
      `SELECT id, user_id, bond_id, side, order_type, quantity,
              filled_quantity, price, avg_fill_price, status, created_at
       FROM trading.orders
       WHERE bond_id = $1
         AND side    = $2
         AND status IN ('Open', 'PartiallyFilled')
         AND user_id != $3
       ORDER BY
         CASE WHEN $2 = 'Sell' THEN price END ASC  NULLS LAST,
         CASE WHEN $2 = 'Buy'  THEN price END DESC NULLS LAST,
         created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [incoming.bondId, counterSide, incoming.userId],
    );
    return r.rows[0] ? this.mapRow(r.rows[0]) : null;
  }

  /** Update filled quantity and running average fill price on an order. */
  async updateFill(orderId: string, fillQty: number, fillPrice: number, client: PoolClient): Promise<void> {
    await client.query(
      `UPDATE trading.orders
       SET filled_quantity = filled_quantity + $1,
           avg_fill_price  = CASE
             WHEN avg_fill_price IS NULL THEN $2
             ELSE (avg_fill_price * filled_quantity + $2 * $1) / (filled_quantity + $1)
           END,
           status     = CASE
             WHEN filled_quantity + $1 >= quantity THEN 'Filled'
             ELSE 'PartiallyFilled'
           END,
           updated_at = NOW()
       WHERE id = $3`,
      [fillQty, fillPrice, orderId],
    );
  }

  async createTrade(params: {
    buyOrderId:   string; sellOrderId:  string;
    buyerId:      string; sellerId:     string;
    bondId:       string; quantity:     number;
    price:        number; buyerFee:     number;
    sellerFee:    number; settlementFee: number;
  }, client: PoolClient): Promise<TradeRecord> {
    const r = await client.query<Record<string, unknown>>(
      `INSERT INTO trading.trades
         (buy_order_id, sell_order_id, buyer_id, seller_id, bond_id,
          quantity, price, buyer_fee, seller_fee, settlement_fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, buyer_id, seller_id, bond_id, quantity, price,
                 buyer_fee, seller_fee, settlement_fee, executed_at`,
      [params.buyOrderId, params.sellOrderId, params.buyerId, params.sellerId,
       params.bondId, params.quantity, params.price, params.buyerFee,
       params.sellerFee, params.settlementFee],
    );
    const row = r.rows[0]!;
    return {
      id:            String(row['id']),
      buyerId:       String(row['buyer_id']),
      sellerId:      String(row['seller_id']),
      bondId:        String(row['bond_id']),
      quantity:      parseFloat(String(row['quantity'])),
      price:         parseFloat(String(row['price'])),
      buyerFee:      parseFloat(String(row['buyer_fee'])),
      sellerFee:     parseFloat(String(row['seller_fee'])),
      settlementFee: parseFloat(String(row['settlement_fee'])),
      executedAt:    row['executed_at'] instanceof Date
        ? row['executed_at'].toISOString() : String(row['executed_at']),
    };
  }

  /** Creates a settlement record and immediately marks it Completed (T+0 for demo). */
  async createSettlement(tradeId: string, client: PoolClient): Promise<void> {
    await client.query(
      `INSERT INTO settlement.settlements
         (trade_id, status, trade_date, settlement_date)
       VALUES ($1, 'Completed', CURRENT_DATE, CURRENT_DATE)
       ON CONFLICT (trade_id) DO NOTHING`,
      [tradeId],
    );
  }

  /** UPSERT portfolio.holdings when a trade is settled. */
  async upsertHolding(
    userId: string, bondId: string,
    qty: number, price: number,
    side: 'credit' | 'debit',
    client: PoolClient,
  ): Promise<void> {
    if (side === 'credit') {
      await client.query(
        `INSERT INTO portfolio.holdings (user_id, bond_id, quantity, avg_buy_price, current_value)
         VALUES ($1, $2, $3, $4, $3 * $4)
         ON CONFLICT (user_id, bond_id) DO UPDATE
           SET quantity      = portfolio.holdings.quantity + EXCLUDED.quantity,
               avg_buy_price = (portfolio.holdings.avg_buy_price * portfolio.holdings.quantity
                                + EXCLUDED.avg_buy_price * EXCLUDED.quantity)
                               / (portfolio.holdings.quantity + EXCLUDED.quantity),
               current_value = (portfolio.holdings.quantity + EXCLUDED.quantity) * EXCLUDED.avg_buy_price,
               updated_at    = NOW()`,
        [userId, bondId, qty, price],
      );
    } else {
      await client.query(
        `UPDATE portfolio.holdings
         SET quantity      = GREATEST(quantity - $3, 0),
             current_value = GREATEST(quantity - $3, 0) * avg_buy_price,
             updated_at    = NOW()
         WHERE user_id = $1 AND bond_id = $2`,
        [userId, bondId, qty],
      );
    }
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
