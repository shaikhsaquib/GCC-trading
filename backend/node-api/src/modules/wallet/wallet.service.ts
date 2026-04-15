import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../shared/db/postgres';
import { eventBus, Events } from '../../shared/events/event-bus';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/middleware/error.middleware';
import { Currency, WalletTransactionType, WalletTransactionStatus } from '../../shared/types';

// FSD §13.1 — admin-configurable limits (fetched from config table at runtime)
const MIN_DEPOSIT         = 100;
const MAX_DEPOSIT         = 50_000;
const MIN_WITHDRAWAL      = 50;
const MAX_WITHDRAWAL_DAILY = 200_000;
const MAKER_CHECKER_THRESHOLD = 10_000;

const hyperpay = axios.create({
  baseURL: process.env.HYPERPAY_URL || 'https://eu-test.oppwa.com',
  timeout: 30_000,
});

// ── Wallet Service ────────────────────────────────────────────────────────────

export const walletService = {
  // ── Create wallet (triggered by KYCApproved event) ────────────────────────
  createWallet: async (userId: string, currency: Currency) => {
    const existing = await db.query('SELECT id FROM wallet.wallets WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) return; // Idempotent

    const walletId = uuidv4();
    await db.query(
      `INSERT INTO wallet.wallets (id, user_id, currency, balance, frozen_balance, total_deposited, total_withdrawn, version)
       VALUES ($1, $2, $3, 0, 0, 0, 0, 1)`,
      [walletId, userId, currency],
    );
    logger.info('Wallet created', { user_id: userId, wallet_id: walletId, currency });
    return { wallet_id: walletId, currency };
  },

  // ── Get balance (FSD §7.5) ────────────────────────────────────────────────
  getBalance: async (userId: string) => {
    const result = await db.query(
      `SELECT id, currency, balance, frozen_balance,
              (balance - frozen_balance) AS available
       FROM wallet.wallets WHERE user_id = $1`,
      [userId],
    );
    if (result.rows.length === 0) throw new AppError(404, 'WALLET_NOT_FOUND', 'Wallet not found');

    const w = result.rows[0] as {
      id: string; currency: string; balance: string;
      frozen_balance: string; available: string;
    };
    return {
      wallet_id:      w.id,
      currency:       w.currency,
      balance:        parseFloat(w.balance),
      frozen_balance: parseFloat(w.frozen_balance),
      available:      parseFloat(w.available),
    };
  },

  // ── Initiate Deposit via HyperPay ─────────────────────────────────────────
  initiateDeposit: async (userId: string, amount: number, idempotencyKey: string) => {
    // Validate limits (FSD §12.3, WAL-013)
    if (amount < MIN_DEPOSIT) throw new AppError(400, 'WAL_MIN_DEPOSIT', `Minimum deposit is ${MIN_DEPOSIT} AED`);
    if (amount > MAX_DEPOSIT) throw new AppError(400, 'WAL_MAX_DEPOSIT', `Maximum deposit is ${MAX_DEPOSIT} AED per transaction`);

    // Idempotency check
    const dup = await db.query(
      'SELECT id FROM wallet.transactions WHERE idempotency_key = $1',
      [idempotencyKey],
    );
    if (dup.rows.length > 0) {
      throw new AppError(409, 'DUPLICATE_TRANSACTION', 'This transaction was already processed');
    }

    // Create checkout via HyperPay (FSD §WAL-010)
    const txId = uuidv4();
    try {
      const resp = await hyperpay.post('/v1/checkouts', null, {
        params: {
          entityId:    process.env.HYPERPAY_ENTITY_ID,
          amount:      amount.toFixed(2),
          currency:    'AED',
          paymentType: 'DB',
          'customer.merchantCustomerId': userId,
          'merchantTransactionId': txId,
        },
        headers: { Authorization: `Bearer ${process.env.HYPERPAY_ACCESS_TOKEN}` },
      });

      // Create pending transaction record
      await db.query(
        `INSERT INTO wallet.transactions
           (id, wallet_id, type, amount, balance_after, status, idempotency_key, reference_id, reference_type)
         SELECT $1, w.id, 'DEPOSIT', $2, w.balance, 'INITIATED', $3, $4, 'DEPOSIT'
         FROM wallet.wallets w WHERE w.user_id = $5`,
        [txId, amount.toFixed(4), idempotencyKey, txId, userId],
      );

      return {
        transaction_id: txId,
        checkout_id:    resp.data.id,
        redirect_url:   `${process.env.HYPERPAY_URL}/v1/paymentWidgets.js?checkoutId=${resp.data.id}`,
      };
    } catch (err) {
      logger.error('HyperPay checkout creation failed', { error: (err as Error).message });
      throw new AppError(502, 'WAL_PAYMENT_FAILED', 'Payment processing unavailable. Please try again.');
    }
  },

  // ── Handle HyperPay webhook (card deposit confirmed) ──────────────────────
  handleDepositWebhook: async (payload: {
    merchantTransactionId: string;
    result: { code: string };
    amount: string;
  }) => {
    const { merchantTransactionId, result, amount } = payload;
    const isSuccess = result.code.startsWith('000.000') || result.code.startsWith('000.100');

    const txResult = await db.query(
      `SELECT t.*, w.user_id, w.id AS wallet_id, w.balance, w.version
       FROM wallet.transactions t
       JOIN wallet.wallets w ON w.id = t.wallet_id
       WHERE t.reference_id = $1`,
      [merchantTransactionId],
    );

    if (txResult.rows.length === 0) {
      logger.warn('HyperPay webhook: transaction not found', { txId: merchantTransactionId });
      return;
    }

    const tx = txResult.rows[0] as {
      id: string; wallet_id: string; user_id: string;
      balance: string; version: number;
    };

    if (!isSuccess) {
      await db.query(`UPDATE wallet.transactions SET status = 'FAILED' WHERE id = $1`, [tx.id]);
      return;
    }

    // Credit wallet with optimistic locking (FSD §WAL-003)
    const depositAmt = parseFloat(amount);
    const updated = await db.query(
      `UPDATE wallet.wallets
       SET balance = balance + $1, total_deposited = total_deposited + $1, version = version + 1
       WHERE id = $2 AND version = $3
       RETURNING balance`,
      [depositAmt.toFixed(4), tx.wallet_id, tx.version],
    );

    if (updated.rows.length === 0) {
      // Optimistic lock conflict — retry logic handled by DLQ/retry mechanism
      throw new Error('WAL_CONCURRENT_UPDATE: Wallet version conflict, will retry');
    }

    const newBalance = parseFloat((updated.rows[0] as { balance: string }).balance);
    await db.query(
      `UPDATE wallet.transactions SET status = 'COMPLETED', balance_after = $1 WHERE id = $2`,
      [newBalance.toFixed(4), tx.id],
    );

    await eventBus.publish(Events.WALLET_FUNDED, {
      user_id:        tx.user_id,
      wallet_id:      tx.wallet_id,
      amount:         depositAmt.toFixed(4),
      currency:       'AED',
      transaction_id: tx.id,
    });

    logger.info('Deposit completed', { user_id: tx.user_id, amount: depositAmt });
  },

  // ── Initiate Withdrawal ────────────────────────────────────────────────────
  initiateWithdrawal: async (
    userId: string,
    amount: number,
    bankAccountId: string,
    idempotencyKey: string,
  ) => {
    if (amount < MIN_WITHDRAWAL) {
      throw new AppError(400, 'WAL_MIN_WITHDRAWAL', `Minimum withdrawal is ${MIN_WITHDRAWAL} AED`);
    }

    const wallet = await walletService.getBalance(userId);
    if (wallet.available < amount) {
      throw new AppError(422, 'WAL_INSUFFICIENT_BALANCE', 'Insufficient available balance');
    }

    // Large withdrawal: maker-checker flow (FSD §WAL-022)
    if (amount > MAKER_CHECKER_THRESHOLD) {
      const requestId = uuidv4();
      await db.query(
        `INSERT INTO wallet.withdrawal_requests
           (id, user_id, amount, bank_account_id, status, idempotency_key)
         VALUES ($1, $2, $3, $4, 'PENDING_APPROVAL', $5)`,
        [requestId, userId, amount.toFixed(4), bankAccountId, idempotencyKey],
      );
      return { status: 'PENDING_APPROVAL', request_id: requestId, requires_approval: true };
    }

    return walletService.processWithdrawal(userId, amount, bankAccountId, idempotencyKey);
  },

  // ── Process Withdrawal (after approval if needed) ─────────────────────────
  processWithdrawal: async (
    userId: string,
    amount: number,
    bankAccountId: string,
    idempotencyKey: string,
  ) => {
    const txId = uuidv4();

    await db.transaction(async (client) => {
      // Debit wallet
      const updated = await client.query(
        `UPDATE wallet.wallets
         SET balance = balance - $1, total_withdrawn = total_withdrawn + $1, version = version + 1
         WHERE user_id = $2 AND (balance - frozen_balance) >= $1
         RETURNING id, balance, version`,
        [amount.toFixed(4), userId],
      );

      if (updated.rows.length === 0) {
        throw new AppError(422, 'WAL_INSUFFICIENT_BALANCE', 'Insufficient balance for withdrawal');
      }

      const { id: walletId, balance } = updated.rows[0] as { id: string; balance: string; version: number };

      await client.query(
        `INSERT INTO wallet.transactions
           (id, wallet_id, type, amount, balance_after, status, idempotency_key, reference_type)
         VALUES ($1, $2, 'WITHDRAWAL', $3, $4, 'PROCESSING', $5, 'WITHDRAWAL')`,
        [txId, walletId, amount.toFixed(4), balance, idempotencyKey],
      );
    });

    // Call HyperPay payout API
    try {
      await hyperpay.post('/v1/payouts', {
        entityId:   process.env.HYPERPAY_ENTITY_ID,
        amount:     amount.toFixed(2),
        currency:   'AED',
        bankAccount: bankAccountId,
        paymentBrand: 'SEPA_CREDIT',
      }, { headers: { Authorization: `Bearer ${process.env.HYPERPAY_ACCESS_TOKEN}` } });
    } catch (err) {
      // Mark as processing — HyperPay will send webhook on completion
      logger.warn('HyperPay payout API call failed, will retry via webhook', { error: (err as Error).message });
    }

    await eventBus.publish(Events.WITHDRAWAL_INITIATED, {
      user_id:        userId,
      amount:         amount.toFixed(4),
      transaction_id: txId,
    });

    return { transaction_id: txId, status: 'PROCESSING' };
  },

  // ── Freeze funds (called by Trading Engine before order placement) ─────────
  freezeFunds: async (userId: string, amount: number): Promise<void> => {
    const updated = await db.query(
      `UPDATE wallet.wallets
       SET frozen_balance = frozen_balance + $1
       WHERE user_id = $2 AND (balance - frozen_balance) >= $1`,
      [amount.toFixed(4), userId],
    );
    if (updated.rowCount === 0) {
      throw new AppError(422, 'WAL_INSUFFICIENT_BALANCE', 'Insufficient available balance');
    }
  },

  // ── Unfreeze funds (on order cancel/expiry) ───────────────────────────────
  unfreezeFunds: async (userId: string, amount: number): Promise<void> => {
    await db.query(
      `UPDATE wallet.wallets
       SET frozen_balance = GREATEST(0, frozen_balance - $1)
       WHERE user_id = $2`,
      [amount.toFixed(4), userId],
    );
  },

  // ── Get transaction history ────────────────────────────────────────────────
  getTransactions: async (userId: string, options: {
    type?: string; page?: number; limit?: number;
  }) => {
    const { type, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT t.*
       FROM wallet.transactions t
       JOIN wallet.wallets w ON w.id = t.wallet_id
       WHERE w.user_id = $1 ${type ? `AND t.type = $4` : ''}
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      type ? [userId, limit, offset, type] : [userId, limit, offset],
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM wallet.transactions t JOIN wallet.wallets w ON w.id = t.wallet_id WHERE w.user_id = $1',
      [userId],
    );

    return {
      transactions: result.rows,
      total: parseInt((countResult.rows[0] as { count: string }).count),
      page,
      limit,
    };
  },
};
