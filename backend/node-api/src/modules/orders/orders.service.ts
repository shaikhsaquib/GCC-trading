import crypto from 'crypto';
import { db }              from '../../core/database/postgres.client';
import { logger }          from '../../core/logger';
import { OrdersRepository }  from './orders.repository';
import { WalletRepository }  from '../wallet/wallet.repository';
import { MatchingEngine }    from './orders.matching';
import { Order, PlaceOrderInput, OrderBookResponse } from './orders.types';
import { NotFoundError, ConflictError, ValidationError } from '../../core/errors';

// Risk tier order-value limits (AED) — mirrors GccBond.Trading constants
const RISK_LIMITS: Record<string, number> = {
  LOW:    10_000,
  MEDIUM: 50_000,
  HIGH:   200_000,
};

// Buyer fee reserved at order placement (matches MatchingEngine.BUYER_FEE_RATE)
const BUYER_FEE_RATE = 0.0025;

export class OrdersService {
  constructor(
    private readonly repo:           OrdersRepository,
    private readonly walletRepo:     WalletRepository,
    private readonly matchingEngine: MatchingEngine,
  ) {}

  async placeOrder(userId: string, input: PlaceOrderInput): Promise<Order> {
    if (input.orderType === 'Limit' && !input.price) {
      throw new ValidationError('Limit orders require a price');
    }

    // Market orders are priced from the best opposite book level. Without any
    // opposite liquidity there is nothing to price/match against, so reject —
    // this also prevents Market-vs-Market fills executing at price 0.
    if (input.orderType === 'Market') {
      const { bids, asks } = await this.repo.getOrderBook(input.bondId, 1);
      const best = input.side === 'Buy' ? asks[0] : bids[0];
      if (!best || best.price <= 0) {
        throw new ValidationError('No liquidity available for a market order on this bond');
      }
      input.price = best.price;
    }

    // ── 1. Risk-tier validation (applies to both Limit and Market) ──────────
    const kycRow = await db.query<{ risk_level: string | null }>(
      `SELECT risk_level FROM kyc.submissions
       WHERE user_id = $1 AND status = 'Approved'
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    const riskLevel  = kycRow.rows[0]?.risk_level ?? 'LOW';
    const maxValue   = RISK_LIMITS[riskLevel] ?? RISK_LIMITS.LOW;

    const orderValueForRisk = input.quantity * (input.price ?? 0);
    if (orderValueForRisk > maxValue) {
      throw new ValidationError(
        `Order value (${orderValueForRisk.toFixed(2)} AED) exceeds your ${riskLevel} risk tier limit of ${maxValue.toLocaleString()} AED`,
      );
    }

    // ── 1b. Sell orders: must actually hold the bonds being sold ────────────
    if (input.side === 'Sell') {
      const holdingRow = await db.query<{ quantity: string }>(
        'SELECT quantity FROM portfolio.holdings WHERE user_id = $1 AND bond_id = $2',
        [userId, input.bondId],
      );
      const held = parseFloat(holdingRow.rows[0]?.quantity ?? '0');
      if (held < input.quantity) {
        throw new ValidationError(
          `Insufficient holdings. You hold ${held} units of this bond, cannot sell ${input.quantity}`,
        );
      }
    }

    // ── 2. Buy orders: check balance and freeze funds ────────────────────────
    let order: Order;

    if (input.side === 'Buy' && input.price) {
      const orderValue   = input.quantity * input.price;
      const reservedFee  = orderValue * BUYER_FEE_RATE;
      const totalReserve = orderValue + reservedFee;

      await db.transaction(async (client) => {
        const wallet = await this.walletRepo.findByUserId(userId, client);
        if (!wallet) throw new NotFoundError('Wallet');

        if (parseFloat(wallet.available_balance) < totalReserve) {
          throw new ValidationError(
            `Insufficient balance. Need ${totalReserve.toFixed(2)} AED ` +
            `(${orderValue.toFixed(2)} + ${reservedFee.toFixed(2)} fee), ` +
            `available: ${parseFloat(wallet.available_balance).toFixed(2)} AED`,
          );
        }

        const frozen = await this.walletRepo.freezeBalance(userId, totalReserve, client);
        if (!frozen) throw new ValidationError('Insufficient balance (concurrent modification)');

        await this.walletRepo.insertTransaction({
          walletId:       wallet.id,
          type:           'FREEZE',
          amount:         totalReserve,
          currency:       wallet.currency,
          status:         'COMPLETED',
          description:    `Buy order — ${input.quantity} units @ ${input.price} (incl. fee reserve)`,
          idempotencyKey: `freeze-${crypto.randomUUID()}`,
        }, client);

        order = await this.repo.create(userId, input, client);
      });
    } else {
      // Sell orders — no upfront freeze (holdings already validated above)
      order = await this.repo.create(userId, input);
    }

    // ── 3. Trigger matching engine asynchronously ────────────────────────────
    this.matchingEngine.matchAsync(order!).catch((err: Error) =>
      logger.error('Matching engine failure', { orderId: order!.id, error: err.message }),
    );

    return order!;
  }

  async getMyOrders(
    userId: string,
    status: string | undefined,
    limit:  number,
    offset: number,
  ): Promise<Order[]> {
    return this.repo.findByUser(userId, status, limit, offset);
  }

  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const existing = await this.repo.findByIdAndUser(orderId, userId);
    if (!existing) throw new NotFoundError('Order');

    let cancelled: Order | null = null;

    await db.transaction(async (client) => {
      cancelled = await this.repo.cancel(orderId, userId, client);
      if (!cancelled) {
        throw new ConflictError(
          `Order cannot be cancelled in status '${existing.status}'`,
        );
      }

      // Unfreeze the unfilled portion reserved at placement
      if (cancelled.side === 'Buy' && cancelled.price !== null) {
        const unfilledQty    = cancelled.quantity - cancelled.filledQuantity;
        const unfilledValue  = unfilledQty * cancelled.price;
        const feeReserved    = unfilledValue * BUYER_FEE_RATE;
        const totalUnfreeze  = unfilledValue + feeReserved;

        if (totalUnfreeze > 0) {
          const wallet = await this.walletRepo.findByUserId(userId, client);
          if (wallet) {
            await this.walletRepo.unfreezeBalance(userId, totalUnfreeze, client);
            await this.walletRepo.insertTransaction({
              walletId:       wallet.id,
              type:           'UNFREEZE',
              amount:         totalUnfreeze,
              currency:       wallet.currency,
              status:         'COMPLETED',
              description:    `Buy order cancelled — ${unfilledQty} units unfrozen`,
              referenceId:    orderId,
              idempotencyKey: `cancel-${orderId}-${crypto.randomUUID()}`,
            }, client);
          }
        }
      }
    });

    return cancelled!;
  }

  async getOrderBook(bondId: string, depth: number): Promise<OrderBookResponse> {
    const { bids, asks } = await this.repo.getOrderBook(bondId, depth);
    return { bondId, bids, asks };
  }
}
