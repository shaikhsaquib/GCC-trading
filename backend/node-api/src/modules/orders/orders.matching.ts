import crypto from 'crypto';
import { PoolClient } from 'pg';
import { db }         from '../../core/database/postgres.client';
import { redis }      from '../../core/database/redis.client';
import { IEventBus }  from '../../core/events/event-bus';
import { EventRoutes } from '../../core/events/event.types';
import { logger }     from '../../core/logger';
import { OrdersRepository }  from './orders.repository';
import { WalletRepository }  from '../wallet/wallet.repository';
import { Order }             from './orders.types';

// Fee schedule — matches .NET MatchingEngine constants
const BUYER_FEE_RATE      = 0.0025; // 25 bps
const SELLER_FEE_RATE     = 0.0025; // 25 bps
const SETTLEMENT_FEE_RATE = 0.0010; // 10 bps

export class MatchingEngine {
  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly walletRepo: WalletRepository,
    private readonly eventBus:   IEventBus,
  ) {}

  /**
   * Fire-and-forget entry point called after an order is persisted.
   * Acquires a per-bond distributed lock so only one matching run
   * operates on a given bond's order book at a time.
   */
  async matchAsync(order: Order): Promise<void> {
    const lockKey = `match:${order.bondId}`;
    const lockId  = crypto.randomUUID();

    const acquired = await redis.tryAcquireLock(lockKey, lockId, 10);
    if (!acquired) {
      // Another instance is already matching this bond; it will pick up our order
      logger.debug('Matching lock busy, skipping', { orderId: order.id });
      return;
    }

    try {
      await this.matchInternal(order);
    } catch (err) {
      logger.error('Matching engine error', { orderId: order.id, error: (err as Error).message });
    } finally {
      await redis.releaseLock(lockKey, lockId);
    }
  }

  private async matchInternal(incoming: Order): Promise<void> {
    let incomingId = incoming.id;

    // Each iteration attempts one fill; loop until no counterparty or fully filled
    for (let iteration = 0; iteration < 100; iteration++) {
      const fresh = await this.ordersRepo.findById(incomingId);
      if (!fresh) break;
      if (fresh.status !== 'Open' && fresh.status !== 'PartiallyFilled') break;

      let matched = false;

      await db.transaction(async (client) => {
        const counterparty = await this.ordersRepo.findBestCounterparty(fresh, client);
        if (!counterparty) return; // no match available

        if (!this.pricesMatch(fresh, counterparty)) return;

        const incomingUnfilled     = fresh.quantity     - fresh.filledQuantity;
        const counterpartyUnfilled = counterparty.quantity - counterparty.filledQuantity;
        const fillQty  = Math.min(incomingUnfilled, counterpartyUnfilled);
        const fillPrice = this.tradePrice(fresh, counterparty);

        await this.executeFill(fresh, counterparty, fillQty, fillPrice, client);
        matched = true;
      });

      if (!matched) break;
    }
  }

  private pricesMatch(incoming: Order, counterparty: Order): boolean {
    if (incoming.orderType === 'Market' || counterparty.orderType === 'Market') return true;
    if (incoming.side === 'Buy') {
      return (incoming.price ?? 0) >= (counterparty.price ?? Infinity);
    }
    return (incoming.price ?? Infinity) <= (counterparty.price ?? 0);
  }

  // Resting (counterparty) order's price wins — standard exchange convention
  private tradePrice(incoming: Order, counterparty: Order): number {
    if (incoming.orderType === 'Market') return counterparty.price ?? 0;
    if (counterparty.orderType === 'Market') return incoming.price ?? 0;
    return counterparty.price ?? incoming.price ?? 0;
  }

  private async executeFill(
    incoming:     Order,
    counterparty: Order,
    fillQty:      number,
    fillPrice:    number,
    client:       PoolClient,
  ): Promise<void> {
    const buyOrder  = incoming.side === 'Buy' ? incoming : counterparty;
    const sellOrder = incoming.side === 'Sell' ? incoming : counterparty;

    const tradeValue    = fillQty * fillPrice;
    const buyerFee      = tradeValue * BUYER_FEE_RATE;
    const sellerFee     = tradeValue * SELLER_FEE_RATE;
    const settlementFee = tradeValue * SETTLEMENT_FEE_RATE;
    const sellerNet     = tradeValue - sellerFee - settlementFee;

    // 1. Record the trade
    const trade = await this.ordersRepo.createTrade({
      buyOrderId: buyOrder.id,  sellOrderId: sellOrder.id,
      buyerId:    buyOrder.userId, sellerId:  sellOrder.userId,
      bondId:     incoming.bondId, quantity:  fillQty,
      price:      fillPrice, buyerFee, sellerFee, settlementFee,
    }, client);

    // 2. Update fill quantities (sets status → PartiallyFilled or Filled)
    await this.ordersRepo.updateFill(incoming.id,     fillQty, fillPrice, client);
    await this.ordersRepo.updateFill(counterparty.id, fillQty, fillPrice, client);

    // 3. Create settlement record (T+0 demo — immediately Completed)
    await this.ordersRepo.createSettlement(trade.id, client);

    // 4. Wallet settlement
    const [buyerWallet, sellerWallet] = await Promise.all([
      this.walletRepo.findByUserId(buyOrder.userId, client),
      this.walletRepo.findByUserId(sellOrder.userId, client),
    ]);

    if (buyerWallet) {
      // Consume the frozen funds reserved at order placement
      await this.walletRepo.consumeFrozenForSettlement(buyOrder.userId, tradeValue, buyerFee, client);
      await this.walletRepo.insertTransaction({
        walletId:       buyerWallet.id,
        type:           'SETTLEMENT_DEBIT',
        amount:         tradeValue + buyerFee,
        currency:       buyerWallet.currency,
        status:         'COMPLETED',
        description:    `Bond purchase — ${fillQty} units @ ${fillPrice}`,
        referenceId:    trade.id,
        idempotencyKey: `settle-buy-${trade.id}`,
      }, client);
    }

    if (sellerWallet) {
      await this.walletRepo.creditSettlement(sellOrder.userId, sellerNet, client);
      await this.walletRepo.insertTransaction({
        walletId:       sellerWallet.id,
        type:           'SETTLEMENT_CREDIT',
        amount:         sellerNet,
        currency:       sellerWallet.currency,
        status:         'COMPLETED',
        description:    `Bond sale — ${fillQty} units @ ${fillPrice}`,
        referenceId:    trade.id,
        idempotencyKey: `settle-sell-${trade.id}`,
      }, client);
    }

    // 5. Portfolio holdings
    await this.ordersRepo.upsertHolding(buyOrder.userId,  incoming.bondId, fillQty, fillPrice, 'credit', client);
    await this.ordersRepo.upsertHolding(sellOrder.userId, incoming.bondId, fillQty, fillPrice, 'debit',  client);

    // 6. Publish event for notifications
    await this.eventBus.publish(EventRoutes.TRADE_EXECUTED, {
      buyer_id:   buyOrder.userId,
      seller_id:  sellOrder.userId,
      bond_id:    incoming.bondId,
      quantity:   String(fillQty),
      price:      String(fillPrice),
      buyer_fee:  String(buyerFee),
      seller_fee: String(sellerFee),
      currency:   buyerWallet?.currency ?? 'AED',
    });

    logger.info('Trade executed', {
      tradeId: trade.id, fillQty, fillPrice,
      buyer: buyOrder.userId, seller: sellOrder.userId,
    });
  }
}
