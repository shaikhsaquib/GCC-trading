import { OrdersRepository } from './orders.repository';
import { Order, PlaceOrderInput, OrderBookResponse } from './orders.types';
import { NotFoundError, ConflictError } from '../../core/errors';

export class OrdersService {
  constructor(private readonly repo: OrdersRepository) {}

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
    // Check order exists and belongs to user
    const existing = await this.repo.findByIdAndUser(orderId, userId);
    if (!existing) {
      throw new NotFoundError('Order');
    }

    // Attempt cancellation — only succeeds if status is Open or PendingValidation
    const cancelled = await this.repo.cancel(orderId, userId);
    if (!cancelled) {
      throw new ConflictError(
        `Order cannot be cancelled in status '${existing.status}'`,
      );
    }

    return cancelled;
  }

  async getOrderBook(bondId: string, depth: number): Promise<OrderBookResponse> {
    const { bids, asks } = await this.repo.getOrderBook(bondId, depth);
    return { bondId, bids, asks };
  }
}
