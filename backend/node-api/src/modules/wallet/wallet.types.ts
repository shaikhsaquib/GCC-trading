export type Currency = 'AED' | 'SAR' | 'KWD' | 'QAR' | 'OMR' | 'BHD' | 'USD';
export type TxType   = 'CREDIT' | 'DEBIT' | 'FREEZE' | 'UNFREEZE' | 'COUPON' | 'SETTLEMENT_CREDIT' | 'SETTLEMENT_DEBIT';
export type TxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface WalletRow {
  id:                string;
  user_id:           string;
  currency:          Currency;
  balance:           string;
  available_balance: string;
  frozen_balance:    string;
  version:           number;
  created_at:        Date;
  updated_at:        Date;
}

export interface TransactionRow {
  id:              string;
  wallet_id:       string;
  type:            TxType;
  amount:          string;
  currency:        Currency;
  status:          TxStatus;
  reference_id:    string | null;
  description:     string | null;
  hyperpay_id:     string | null;
  idempotency_key: string;
  metadata:        Record<string, unknown> | null;
  created_at:      Date;
}

export interface WithdrawalRow {
  id:              string;
  user_id:         string;
  amount:          string;
  currency:        Currency;
  bank_name:       string;
  iban:            string;
  status:          string;
  idempotency_key: string;
  created_at:      Date;
}

// DTOs
export interface DepositDto {
  amount:   number;
  currency: Currency;
  method?:  string;
}

export interface WithdrawDto {
  amount:   number;
  currency: Currency;
  bankName: string;
  iban:     string;
  totpCode: string;
}

export interface BalanceResponse {
  balance:          number;
  availableBalance: number;
  frozenBalance:    number;
  currency:         Currency;
}

export interface PaginationQuery {
  limit?:  number;
  offset?: number;
}
