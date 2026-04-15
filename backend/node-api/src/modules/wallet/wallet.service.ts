import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { db } from '../../core/database/postgres.client';
import { IEventBus } from '../../core/events/event-bus';
import { EventRoutes } from '../../core/events/event.types';
import { NotFoundError, UnprocessableError, ValidationError } from '../../core/errors';
import { WalletRepository } from './wallet.repository';
import {
  DepositDto, WithdrawDto, BalanceResponse,
  PaginationQuery, Currency,
} from './wallet.types';

const MAKER_CHECKER_THRESHOLD = 10_000; // AED — withdrawals above this need approval
const MAX_DEPOSIT             = 500_000;
const MAX_RETRY               = 3;

export class WalletService {
  constructor(
    private readonly repo:     WalletRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async createWallet(userId: string, currency: Currency): Promise<void> {
    await this.repo.create(userId, currency);
  }

  async getBalance(userId: string): Promise<BalanceResponse> {
    const wallet = await this.repo.findByUserId(userId);
    if (!wallet) throw new NotFoundError('Wallet');

    return {
      balance:          parseFloat(wallet.balance),
      availableBalance: parseFloat(wallet.available_balance),
      frozenBalance:    parseFloat(wallet.frozen_balance),
      currency:         wallet.currency,
    };
  }

  async initiateDeposit(userId: string, dto: DepositDto): Promise<{ checkoutUrl: string; transactionId: string }> {
    if (dto.amount > MAX_DEPOSIT) {
      throw new ValidationError(`Maximum deposit is ${MAX_DEPOSIT} ${dto.currency}`);
    }

    const wallet = await this.repo.findByUserId(userId);
    if (!wallet) throw new NotFoundError('Wallet');

    const idempotencyKey = uuidv4();

    // Record pending transaction
    const tx = await this.repo.insertTransaction({
      walletId:       wallet.id,
      type:           'CREDIT',
      amount:         dto.amount,
      currency:       dto.currency,
      status:         'PENDING',
      description:    'HyperPay deposit',
      idempotencyKey,
    });

    // Create HyperPay checkout session
    let checkoutUrl = `https://payment-staging.gccbond.com/pay/${tx.id}`;
    if (config.hyperpay.apiKey) {
      try {
        const res = await axios.post(
          'https://eu-test.oppwa.com/v1/checkouts',
          new URLSearchParams({
            'entityId':               config.hyperpay.entityId,
            'amount':                 dto.amount.toFixed(2),
            'currency':               dto.currency,
            'paymentType':            'DB',
            'merchantTransactionId':  tx.id,
          }),
          { headers: { Authorization: `Bearer ${config.hyperpay.apiKey}` } },
        );
        checkoutUrl = `https://eu-test.oppwa.com/v1/paymentWidgets.js?checkoutId=${res.data.id}`;
      } catch {
        // Non-fatal — return placeholder for dev
      }
    }

    return { checkoutUrl, transactionId: tx.id };
  }

  async handleDepositWebhook(hyperpayId: string, transactionId: string): Promise<void> {
    // Idempotency guard
    const existing = await this.repo.findTransactionByIdempotencyKey(transactionId);
    if (existing?.status === 'COMPLETED') return;

    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      await db.transaction(async (client) => {
        const tx = await this.repo.findTransactionByIdempotencyKey(transactionId);
        if (!tx) throw new NotFoundError('Transaction');

        const wallet = await this.repo.findByUserId(
          await getUserIdFromWalletId(tx.wallet_id),
          client,
        );
        if (!wallet) throw new NotFoundError('Wallet');

        const credited = await this.repo.creditWithVersion(
          wallet.id,
          parseFloat(tx.amount),
          wallet.version,
          client,
        );

        if (!credited) throw new Error('Version conflict — retry');

        await this.repo.updateTransactionStatus(tx.id, 'COMPLETED', client);
      });

      // Publish event for notifications
      const tx = await this.repo.findTransactionByIdempotencyKey(transactionId);
      if (tx?.status === 'COMPLETED') {
        const walletUserId = await getUserIdFromWalletId(tx.wallet_id);
        await this.eventBus.publish(EventRoutes.WALLET_FUNDED, {
          user_id:        walletUserId,
          amount:         tx.amount,
          currency:       tx.currency,
          transaction_id: transactionId,
        });
        return;
      }
    }

    throw new UnprocessableError('Deposit processing failed after retries');
  }

  async initiateWithdrawal(userId: string, dto: WithdrawDto): Promise<{ requestId: string; requiresApproval: boolean }> {
    const wallet = await this.repo.findByUserId(userId);
    if (!wallet) throw new NotFoundError('Wallet');

    if (parseFloat(wallet.available_balance) < dto.amount) {
      throw new ValidationError('Insufficient available balance');
    }

    const requiresApproval = dto.amount > MAKER_CHECKER_THRESHOLD;
    const idempotencyKey   = uuidv4();

    const request = await this.repo.createWithdrawalRequest({
      userId,
      amount:         dto.amount,
      currency:       dto.currency,
      bankName:       dto.bankName,
      iban:           dto.iban,
      idempotencyKey,
    });

    return { requestId: request.id, requiresApproval };
  }

  async getTransactions(userId: string, query: PaginationQuery): Promise<{ data: unknown[]; total: number }> {
    const wallet = await this.repo.findByUserId(userId);
    if (!wallet) throw new NotFoundError('Wallet');

    const { rows, total } = await this.repo.getTransactions(
      wallet.id,
      query.limit  ?? 20,
      query.offset ?? 0,
    );
    return { data: rows, total };
  }
}

// Helper — in a real system this would be a JOIN or denormalized column
async function getUserIdFromWalletId(walletId: string): Promise<string> {
  const r = await db.query<{ user_id: string }>(
    'SELECT user_id FROM wallet.wallets WHERE id = $1',
    [walletId],
  );
  return r.rows[0]?.user_id ?? '';
}
