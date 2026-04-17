export type SettlementStatus = 'Pending' | 'Processing' | 'Settled' | 'Failed';

export interface Settlement {
  id:             string;
  tradeId:        string;
  bondId:         string;
  bondName:       string;
  isin:           string;
  side:           'Buy' | 'Sell';
  quantity:       number;
  price:          number;
  value:          number;
  buyerId:        string;
  sellerId:       string;
  status:         SettlementStatus;
  tradeDate:      string;
  settlementDate: string;
  failureReason:  string | null;
  createdAt:      string;
}

export interface SettlementStats {
  pending:    number;
  processing: number;
  completed:  number;
  failed:     number;
  totalValue: number;
}

export interface SettlementListResponse {
  items: Settlement[];
  stats: SettlementStats;
  total: number;
}
