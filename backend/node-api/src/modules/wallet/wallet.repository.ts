import { PoolClient, QueryResult } from 'pg';
import { db } from '../../core/database/postgres.client';
import { WalletRow, TransactionRow, WithdrawalRow, Currency } from './wallet.types';

type Queryable = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> };

export class WalletRepository {
  async findByUserId(userId: string, client?: PoolClient): Promise<WalletRow | null> {
    const q: Queryable = client ?? db;
    const r = await q.query<WalletRow>(
      'SELECT * FROM wallet.wallets WHERE user_id = $1',
      [userId],
    );
    return r.rows[0] ?? null;
  }

  async create(userId: string, currency: Currency): Promise<WalletRow> {
    const r = await db.query<WalletRow>(
      `INSERT INTO wallet.wallets (user_id, currency)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId, currency],
    );
    return r.rows[0];
  }

  /**
   * Optimistic-locking credit — fails silently if version mismatch.
   * Returns true if updated, false if conflict (caller should retry).
   */
  async creditWithVersion(
    walletId: string,
    amount:   number,
    version:  number,
    client:   PoolClient,
  ): Promise<boolean> {
    const r = await client.query(
      `UPDATE wallet.wallets
       SET balance           = balance + $1,
           available_balance = available_balance + $1,
           version           = version + 1,
           updated_at        = NOW()
       WHERE id = $2 AND version = $3`,
      [amount, walletId, version],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async freezeBalance(userId: string, amount: number, client?: PoolClient): Promise<boolean> {
    const q: Queryable = client ?? db;
    const r = await q.query(
      `UPDATE wallet.wallets
       SET available_balance = available_balance - $1,
           frozen_balance    = frozen_balance    + $1,
           updated_at        = NOW()
       WHERE user_id = $2 AND available_balance >= $1`,
      [amount, userId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async unfreezeBalance(userId: string, amount: number, client?: PoolClient): Promise<void> {
    const q: Queryable = client ?? db;
    await q.query(
      `UPDATE wallet.wallets
       SET available_balance = available_balance + $1,
           frozen_balance    = frozen_balance    - $1,
           updated_at        = NOW()
       WHERE user_id = $2`,
      [amount, userId],
    );
  }

  async insertTransaction(params: {
    walletId:       string;
    type:           string;
    amount:         number;
    currency:       string;
    status:         string;
    referenceId?:   string;
    description?:   string;
    hyperpayId?:    string;
    idempotencyKey: string;
    metadata?:      Record<string, unknown>;
  }, client?: PoolClient): Promise<TransactionRow> {
    const q: Queryable = client ?? db;
    const r = await q.query<TransactionRow>(
      `INSERT INTO wallet.transactions
         (wallet_id, type, amount, currency, status, reference_id,
          description, hyperpay_id, idempotency_key, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        params.walletId, params.type, params.amount, params.currency,
        params.status, params.referenceId ?? null, params.description ?? null,
        params.hyperpayId ?? null, params.idempotencyKey,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
    return r.rows[0];
  }

  async findTransactionByIdempotencyKey(key: string): Promise<TransactionRow | null> {
    const r = await db.query<TransactionRow>(
      'SELECT * FROM wallet.transactions WHERE idempotency_key = $1',
      [key],
    );
    return r.rows[0] ?? null;
  }

  async updateTransactionStatus(id: string, status: string, client?: PoolClient): Promise<void> {
    const q: Queryable = client ?? db;
    await q.query(
      'UPDATE wallet.transactions SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id],
    );
  }

  async getTransactions(walletId: string, limit: number, offset: number): Promise<{ rows: TransactionRow[]; total: number }> {
    const [rows, count] = await Promise.all([
      db.query<TransactionRow>(
        'SELECT * FROM wallet.transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [walletId, limit, offset],
      ),
      db.query<{ count: string }>(
        'SELECT COUNT(*) FROM wallet.transactions WHERE wallet_id = $1',
        [walletId],
      ),
    ]);
    return { rows: rows.rows, total: parseInt(count.rows[0].count, 10) };
  }

  /**
   * Buyer settlement: consume frozen funds.
   * frozen_balance -= tradeAmount  (funds leave escrow)
   * balance        -= tradeAmount + fee  (total cost leaves balance)
   * available_balance -= fee  (fee deducted from available)
   */
  async consumeFrozenForSettlement(
    userId:      string,
    tradeAmount: number,
    fee:         number,
    client?:     PoolClient,
  ): Promise<void> {
    const q: Queryable = client ?? db;
    await q.query(
      `UPDATE wallet.wallets
       SET frozen_balance    = frozen_balance    - $1,
           balance           = balance           - ($1 + $2),
           available_balance = available_balance - $2,
           updated_at        = NOW()
       WHERE user_id = $3`,
      [tradeAmount, fee, userId],
    );
  }

  /**
   * Seller settlement: credit net proceeds.
   * available_balance += netAmount
   * balance           += netAmount
   */
  async creditSettlement(
    userId:    string,
    netAmount: number,
    client?:   PoolClient,
  ): Promise<void> {
    const q: Queryable = client ?? db;
    await q.query(
      `UPDATE wallet.wallets
       SET available_balance = available_balance + $1,
           balance           = balance           + $1,
           updated_at        = NOW()
       WHERE user_id = $2`,
      [netAmount, userId],
    );
  }

  async debitBalance(userId: string, amount: number, client?: PoolClient): Promise<boolean> {
    const q: Queryable = client ?? db;
    const r = await q.query(
      `UPDATE wallet.wallets
       SET balance           = balance           - $1,
           available_balance = available_balance - $1,
           version           = version + 1,
           updated_at        = NOW()
       WHERE user_id = $2 AND available_balance >= $1`,
      [amount, userId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async createWithdrawalRequest(params: {
    userId:         string;
    amount:         number;
    currency:       string;
    bankName:       string;
    iban:           string;
    idempotencyKey: string;
  }): Promise<WithdrawalRow> {
    const r = await db.query<WithdrawalRow>(
      `INSERT INTO wallet.withdrawal_requests
         (user_id, amount, currency, bank_name, iban, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [params.userId, params.amount, params.currency, params.bankName, params.iban, params.idempotencyKey],
    );
    return r.rows[0];
  }
}
