import { PortfolioRepository } from './portfolio.repository';
import { PortfolioHolding, PortfolioSummary, CouponEvent } from './portfolio.types';

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

  async getCouponCalendar(userId: string): Promise<CouponEvent[]> {
    const rows = await this.repo.findCouponCalendarData(userId);
    const events: CouponEvent[] = [];
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const ceiling = new Date(today); ceiling.setFullYear(ceiling.getFullYear() + 2);

    const freqMap: Record<string, number> = {
      Annual: 1, SemiAnnual: 2, Quarterly: 4,
    };

    for (const row of rows) {
      const paymentsPerYear   = freqMap[row.couponFrequency] ?? 1;
      const intervalMonths    = Math.round(12 / paymentsPerYear);
      const maturity          = new Date(row.maturityDate);
      const couponPerPayment  = parseFloat(
        ((row.couponRate / 100 / paymentsPerYear) * row.quantity * row.faceValue).toFixed(2),
      );

      // Anchor on maturity date and walk back to find first upcoming coupon
      let d = new Date(maturity.getFullYear(), maturity.getMonth(), maturity.getDate());
      while (d > today) {
        d = new Date(d.getFullYear(), d.getMonth() - intervalMonths, d.getDate());
      }
      d = new Date(d.getFullYear(), d.getMonth() + intervalMonths, d.getDate());

      while (d <= maturity && d <= ceiling) {
        if (d >= today) {
          events.push({
            bondId:     row.bondId,
            bondName:   row.bondName,
            isin:       row.isin,
            date:       d.toISOString().split('T')[0],
            amount:     couponPerPayment,
            couponRate: row.couponRate,
          });
        }
        d = new Date(d.getFullYear(), d.getMonth() + intervalMonths, d.getDate());
      }
    }

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }
}
