// ---------------------------------------------------------------------------
// Domain event envelope — every event is wrapped in this.
// ---------------------------------------------------------------------------

export interface DomainEvent<T = unknown> {
  eventId:       string;
  eventType:     string;
  source:        string;
  payload:       T;
  correlationId: string;
  timestamp:     string;
}

// ---------------------------------------------------------------------------
// Well-known routing keys (used as RabbitMQ routing keys and for subscribe())
// ---------------------------------------------------------------------------

export const EventRoutes = {
  USER_REGISTERED:    'user.registered',
  KYC_APPROVED:       'kyc.approved',
  KYC_REJECTED:       'kyc.rejected',
  WALLET_FUNDED:      'wallet.funded',
  TRADE_EXECUTED:     'trade.executed',
  ORDER_FILLED:       'order.filled',
  ORDER_CANCELLED:    'order.cancelled',
  SETTLEMENT_DONE:    'settlement.completed',
  COUPON_PAID:        'coupon.paid',
  AML_ALERT:          'aml.alert',
} as const;

export type EventRoute = typeof EventRoutes[keyof typeof EventRoutes];

// ---------------------------------------------------------------------------
// Typed event payloads
// ---------------------------------------------------------------------------

export interface UserRegisteredPayload {
  user_id:    string;
  email:      string;
  first_name: string;
}

export interface KycApprovedPayload {
  user_id:    string;
  kyc_id:     string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface KycRejectedPayload {
  user_id:            string;
  reason:             string;
  remaining_attempts: number;
}

export interface WalletFundedPayload {
  user_id:        string;
  amount:         string;
  currency:       string;
  transaction_id: string;
}

export interface TradeExecutedPayload {
  trade_id:   string;
  buyer_id:   string;
  seller_id:  string;
  bond_id:    string;
  quantity:   string;
  price:      string;
  buyer_fee:  string;
  seller_fee: string;
  currency:   string;
}

export interface CouponPaidPayload {
  user_id:  string;
  bond_id:  string;
  amount:   string;
  currency: string;
}
