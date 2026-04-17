import { v4 as uuidv4 } from 'uuid';
import { db } from '../../core/database/postgres.client';
import { OrdersRepository } from './orders.repository';
import { WalletRepository } from '../wallet/wallet.repository';
import { Order, PlaceOrderInput, OrderBookResponse } from './orders.types';
import { NotFoundError, ConflictError } from '../../core/errors';

export class OrdersService {
  constructor(
    private readonly repo:       OrdersRepository,
    private readonly walletRepo: WalletRepository,
  ) {}

  async placeOrder(userId: string, input: PlaceOrderInput): Promise<Order> {
    return this.repo.create(userId, input);
  }

  async getMyOrders(
    userId: string,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<Order[]> {
    return this.repo.findByUser(userId, status, limit, offset);
  }

  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const existing = await this.repo.findByIdAndUser(orderId, userId);
    if (!existing) throw new NotFoundError('Order');

    let cancelled: Order | null = null;

    await db.transaction(async (client) => {
      // Cancel the order atomically
      cancelled = await this.repo.cancel(orderId, userId, client);
      if (!cancelled) {
        throw new ConflictError(
          `Order cannot be cancelled in status '${existing.status}'`,
        );
      }

      // For Buy orders, unfreeze the unfilled portion of funds
      if (cancelled.side === 'Buy' && cancelled.price !== null) {
        const unfilledQty    = cancelled.quantity - cancelled.filledQuantity;
        const unfilledAmount = unfilledQty * cancelled.price;

        if (unfilledAmount > 0) {
          const wallet = await this.walletRepo.findByUserId(userId, client);
          if (wallet) {
            await this.walletRepo.unfreezeBalance(userId, unfilledAmount, client);
            await this.walletRepo.insertTransaction({
              walletId:       wallet.id,
              type:           'UNFREEZE',
              amount:         unfilledAmount,
              currency:       wallet.currency,
              status:         'COMPLETED',
              description:    `Order cancelled — ${unfilledQty} units unfrozen`,
              referenceId:    orderId,
              idempotencyKey: `cancel-${orderId}-${uuidv4()}`,
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
