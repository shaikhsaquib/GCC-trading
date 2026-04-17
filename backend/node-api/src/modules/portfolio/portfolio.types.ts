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
  issuerName:          string;
  issuerType:          string;
  couponRate:          number;
  maturityDate:        string;
  currentPrice:        number;
  creditRating:        string;
  isShariaCompliant:   boolean;
}

export interface PortfolioSummary {
  totalValue:          number;
  totalCost:           number;
  unrealizedPnl:       number;
  totalCouponReceived: number;
  holdingsCount:       number;
  currency:            string;
}

export interface CouponEvent {
  bondId:     string;
  bondName:   string;
  isin:       string;
  date:       string;
  amount:     number;
  couponRate: number;
}

export interface HoldingCalendarRow {
  bondId:          string;
  bondName:        string;
  isin:            string;
  couponRate:      number;
  couponFrequency: string;
  maturityDate:    string;
  faceValue:       number;
  quantity:        number;
}
