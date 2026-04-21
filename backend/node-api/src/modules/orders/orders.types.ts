export interface Order {
  id:             string;
  userId:         string;
  bondId:         string;
  side:           'Buy' | 'Sell';
  orderType:      'Market' | 'Limit';
  quantity:       number;
  filledQuantity: number;
  price:          number | null;
  avgFillPrice:   number | null;
  status:         string;
  createdAt:      string;
}

export interface PlaceOrderInput {
  bondId:    string;
  side:      'Buy' | 'Sell';
  orderType: 'Market' | 'Limit';
  quantity:  number;
  price?:    number;
  tif?:      'Day' | 'GTC' | 'FOK' | 'IOC';
}

export interface TradeRecord {
  id:            string;
  buyerId:       string;
  sellerId:      string;
  bondId:        string;
  quantity:      number;
  price:         number;
  buyerFee:      number;
  sellerFee:     number;
  settlementFee: number;
  executedAt:    string;
}

export interface OrderBookEntry {
  price:      number;
  quantity:   number;
  orderCount: number;
}

export interface OrderBookResponse {
  bondId: string;
  bids:   OrderBookEntry[];
  asks:   OrderBookEntry[];
}
