// ── Auth ──────────────────────────────────────────────────────────────────────

export type UserRole   = 'INVESTOR' | 'KYC_OFFICER' | 'L2_ADMIN' | 'ADMIN' | 'COMPLIANCE';
export type UserStatus = 'PENDING_KYC' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface User {
  id:        string;
  email:     string;
  firstName: string;
  lastName:  string;
  role:      UserRole;
  status:    UserStatus;
}

export interface TokenPair {
  accessToken:  string;
  refreshToken: string;
}

export interface LoginResponse extends TokenPair {
  user: User;
}

export interface Require2FAResponse {
  requires2FA: true;
  tempToken:   string;
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletBalance {
  balance:          number;
  availableBalance: number;
  frozenBalance:    number;
  currency:         string;
}

export interface WalletTransaction {
  id:            string;
  type:          'CREDIT' | 'DEBIT' | 'FREEZE' | 'UNFREEZE' | 'COUPON' | 'SETTLEMENT_CREDIT' | 'SETTLEMENT_DEBIT';
  amount:        string;
  currency:      string;
  status:        'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  description:   string;
  reference_id:  string;
  idempotency_key: string;
  created_at:    string;
}

export interface Paginated<T> {
  data:  T[];
  total: number;
}

// ── Bonds ─────────────────────────────────────────────────────────────────────

export interface Bond {
  id:                 string;
  isin:               string;
  name:               string;
  issuerName:         string;
  issuerType:         'Government' | 'Corporate';
  currency:           string;
  faceValue:          number;
  couponRate:         number;
  couponFrequency:    'Annual' | 'SemiAnnual' | 'Quarterly';
  maturityDate:       string;
  creditRating:       string;
  isShariaCompliant:  boolean;
  minInvestment:      number;
  currentPrice:       number;
  status:             'Active' | 'Delisted' | 'Matured';
}

export interface PagedBondResponse {
  items:      Bond[];
  totalCount: number;
  page:       number;
  pageSize:   number;
}

// ── Orders ────────────────────────────────────────────────────────────────────

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

export interface OrderBookEntry { price: number; quantity: number; orderCount: number; }
export interface OrderBookResponse {
  bondId: string;
  bids:   OrderBookEntry[];
  asks:   OrderBookEntry[];
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export interface PortfolioHolding {
  id:                   string;
  bondId:               string;
  bondName:             string;
  isin:                 string;
  quantity:             number;
  avgBuyPrice:          number;
  currentValue:         number;
  unrealizedPnl:        number;
  totalCouponReceived:  number;
}

export interface PortfolioSummary {
  totalValue:          number;
  totalCost:           number;
  unrealizedPnl:       number;
  totalCouponReceived: number;
  holdingsCount:       number;
  currency:            string;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface Notification {
  id:        string;
  eventType: string;
  channels:  string[];
  vars:      Record<string, string>;
  read:      boolean;
  createdAt: string;
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers:       number;
  activeUsers:      number;
  pendingKyc:       number;
  totalBonds:       number;
  openOrders:       number;
  tradesToday:      number;
  tradeVolumeToday: number;
}

export interface AdminUser {
  id:                 string;
  first_name:         string;
  last_name:          string;
  email?:             string;
  role:               string;
  status:             string;
  nationality:        string;
  preferred_currency: string;
  created_at:         string;
  last_login_at:      string | null;
}

// ── AML ───────────────────────────────────────────────────────────────────────

export interface AmlAlert {
  id:          string;
  userId:      string;
  ruleCode:    string;
  description: string;
  severity:    'Low' | 'Medium' | 'High' | 'Critical';
  status:      'Open' | 'UnderReview' | 'Escalated' | 'Cleared' | 'SarFiled';
  amount:      number;
  currency:    string;
  sarRef:      string | null;
  createdAt:   string;
}

// ── Shared API wrapper ────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  error?:  string;
}
