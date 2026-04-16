export interface PortfolioHolding {
  id:                  string;
  bondId:              string;
  bondName:            string;
  isin:                string;
  quantity:            number;
  avgBuyPrice:         number;
  currentValue:        number;
  unrealizedPnl:       number;
  totalCouponReceived: number;
}

export interface PortfolioSummary {
  totalValue:          number;
  totalCost:           number;
  unrealizedPnl:       number;
  totalCouponReceived: number;
  holdingsCount:       number;
  currency:            string;
}
