import { PortfolioRepository } from './portfolio.repository';
import { PortfolioHolding, PortfolioSummary } from './portfolio.types';

export class PortfolioService {
  constructor(private readonly repo: PortfolioRepository) {}

  async getHoldings(userId: string): Promise<PortfolioHolding[]> {
    return this.repo.findHoldingsByUser(userId);
  }

  async getSummary(userId: string): Promise<PortfolioSummary> {
    const holdings = await this.repo.findHoldingsByUser(userId);

    const totalValue          = holdings.reduce((sum, h) => sum + h.currentValue,        0);
    const totalCost           = holdings.reduce((sum, h) => sum + h.avgBuyPrice * h.quantity, 0);
    const unrealizedPnl       = holdings.reduce((sum, h) => sum + h.unrealizedPnl,       0);
    const totalCouponReceived = holdings.reduce((sum, h) => sum + h.totalCouponReceived,  0);

    return {
      totalValue,
      totalCost,
      unrealizedPnl,
      totalCouponReceived,
      holdingsCount: holdings.length,
      currency:      'AED',
    };
  }

  async getCouponCalendar(_userId: string): Promise<unknown[]> {
    // No coupon_schedule table in the current schema — return empty array
    return [];
  }
}
