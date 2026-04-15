// ─────────────────────────────────────────────────────────────────────────────
// GCC Bond Platform — Shared TypeScript Types & Interfaces
// Mirrors the DB schemas defined in FSD §6 and API specs in §7
// ─────────────────────────────────────────────────────────────────────────────

import { Request } from 'express';

// ── Enums ────────────────────────────────────────────────────────────────────

export enum UserStatus {
  REGISTERED    = 'REGISTERED',
  KYC_SUBMITTED = 'KYC_SUBMITTED',
  KYC_RESUBMIT  = 'KYC_RESUBMIT',
  KYC_APPROVED  = 'KYC_APPROVED',
  KYC_REJECTED  = 'KYC_REJECTED',
  ACTIVE        = 'ACTIVE',
  SUSPENDED     = 'SUSPENDED',
  DEACTIVATED   = 'DEACTIVATED',
}

export enum UserRole {
  USER        = 'USER',
  ADMIN_L1    = 'ADMIN_L1',
  ADMIN_L2    = 'ADMIN_L2',
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPLIANCE  = 'COMPLIANCE',
}

export enum RiskLevel {
  LOW    = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH   = 'HIGH',
}

export enum KycStatus {
  DRAFT               = 'DRAFT',
  SUBMITTED           = 'SUBMITTED',
  ONFIDO_PROCESSING   = 'ONFIDO_PROCESSING',
  AUTO_APPROVED       = 'AUTO_APPROVED',
  MANUAL_REVIEW       = 'MANUAL_REVIEW',
  APPROVED            = 'APPROVED',
  REJECTED            = 'REJECTED',
  RESUBMIT_REQUESTED  = 'RESUBMIT_REQUESTED',
  ONFIDO_FAILED       = 'ONFIDO_FAILED',
}

export enum OrderStatus {
  PENDING_VALIDATION  = 'PENDING_VALIDATION',
  VALIDATED           = 'VALIDATED',
  REJECTED            = 'REJECTED',
  OPEN                = 'OPEN',
  PARTIALLY_FILLED    = 'PARTIALLY_FILLED',
  FILLED              = 'FILLED',
  CANCELLED           = 'CANCELLED',
  EXPIRED             = 'EXPIRED',
  PENDING_SETTLEMENT  = 'PENDING_SETTLEMENT',
  SETTLED             = 'SETTLED',
  SETTLEMENT_FAILED   = 'SETTLEMENT_FAILED',
}

export enum OrderSide {
  BUY  = 'BUY',
  SELL = 'SELL',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT  = 'LIMIT',
}

export enum WalletTransactionType {
  DEPOSIT    = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRADE_BUY  = 'TRADE_BUY',
  TRADE_SELL = 'TRADE_SELL',
  COUPON     = 'COUPON',
  FEE        = 'FEE',
  REVERSAL   = 'REVERSAL',
}

export enum WalletTransactionStatus {
  INITIATED  = 'INITIATED',
  PROCESSING = 'PROCESSING',
  COMPLETED  = 'COMPLETED',
  FAILED     = 'FAILED',
  REVERSED   = 'REVERSED',
}

export enum SettlementStatus {
  PENDING        = 'PENDING',
  PROCESSING     = 'PROCESSING',
  RECONCILING    = 'RECONCILING',
  COMPLETED      = 'COMPLETED',
  FAILED         = 'FAILED',
}

export enum BondStatus {
  ACTIVE   = 'ACTIVE',
  DELISTED = 'DELISTED',
  MATURED  = 'MATURED',
}

export enum IssuerType {
  GOVERNMENT   = 'GOVERNMENT',
  CORPORATE    = 'CORPORATE',
}

export enum CouponFrequency {
  ANNUAL      = 'ANNUAL',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  QUARTERLY   = 'QUARTERLY',
}

export enum Currency {
  AED = 'AED',
  SAR = 'SAR',
  BHD = 'BHD',
  KWD = 'KWD',
  QAR = 'QAR',
}

export enum CountryCode {
  AE = 'AE',
  SA = 'SA',
  BH = 'BH',
  KW = 'KW',
  QA = 'QA',
}

// ── DB Models ────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  phone: string;
  password_hash: string;
  keycloak_id?: string;
  status: UserStatus;
  role: UserRole;
  risk_level?: RiskLevel;
  two_fa_enabled: boolean;
  two_fa_secret?: string;
  preferred_currency: Currency;
  preferred_language: 'en' | 'ar';
  failed_login_count: number;
  locked_until?: Date;
  version: number;
  created_at: Date;
  updated_at: Date;
  is_deleted: boolean;
  // personal info
  first_name?: string;
  last_name?: string;
  country_code?: CountryCode;
}

export interface Wallet {
  id: string;
  user_id: string;
  currency: Currency;
  balance: string;           // DECIMAL(18,4) as string to avoid float issues
  frozen_balance: string;
  total_deposited: string;
  total_withdrawn: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: WalletTransactionType;
  amount: string;
  balance_after: string;
  reference_id?: string;
  reference_type?: string;
  status: WalletTransactionStatus;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}

export interface KycSubmission {
  id: string;
  user_id: string;
  status: KycStatus;
  onfido_check_id?: string;
  onfido_applicant_id?: string;
  liveness_score?: number;
  risk_score?: number;
  risk_level?: RiskLevel;
  rejection_reason?: string;
  resubmission_count: number;
  submitted_at?: Date;
  reviewed_at?: Date;
  reviewed_by?: string;
  documents: KycDocument[];
  created_at: Date;
  updated_at: Date;
}

export interface KycDocument {
  id: string;
  kyc_id: string;
  type: 'ID_FRONT' | 'ID_BACK' | 'SELFIE' | 'BANK_STATEMENT';
  file_path: string;       // encrypted path in MongoDB
  file_size: number;
  mime_type: string;
  onfido_document_id?: string;
  is_verified: boolean;
  ocr_data?: Record<string, unknown>;
  created_at: Date;
}

export interface Bond {
  id: string;
  isin: string;
  name: string;
  issuer_name: string;
  issuer_type: IssuerType;
  currency: Currency;
  face_value: string;
  coupon_rate: string;
  coupon_frequency: CouponFrequency;
  maturity_date: Date;
  credit_rating?: string;
  is_sharia_compliant: boolean;
  min_investment: string;
  current_price: string;
  status: BondStatus;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: string;
  user_id: string;
  bond_id: string;
  side: OrderSide;
  order_type: OrderType;
  quantity: string;
  filled_quantity: string;
  price?: string;
  avg_fill_price?: string;
  status: OrderStatus;
  expires_at?: Date;
  cancel_reason?: string;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}

// ── API Request/Response types ────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  first_name: string;
  last_name: string;
  country_code: CountryCode;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_fingerprint?: string;
}

export interface TwoFAVerifyRequest {
  code: string;
  method: 'totp' | 'sms';
}

export interface PlaceOrderRequest {
  bond_id: string;
  side: OrderSide;
  order_type: OrderType;
  quantity: number;
  price?: number;
  idempotency_key: string;
}

export interface DepositRequest {
  amount: number;
  payment_method: 'card' | 'bank_transfer';
  idempotency_key: string;
}

export interface WithdrawalRequest {
  amount: number;
  bank_account_id: string;
  totp_code: string;
  idempotency_key: string;
}

// ── Express augmentation ──────────────────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
  };
}

// ── API Response wrappers ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  request_id?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
  next_cursor?: string;
}

// ── Domain Events (RabbitMQ messages) ────────────────────────────────────────

export interface DomainEvent<T = unknown> {
  event_id: string;
  event_type: string;
  timestamp: string;
  version: string;
  payload: T;
  correlation_id?: string;
}

export interface UserRegisteredEvent {
  user_id: string;
  email: string;
  phone: string;
  first_name: string;
  country_code: CountryCode;
}

export interface KycApprovedEvent {
  user_id: string;
  kyc_id: string;
  risk_level: RiskLevel;
  approved_by?: string;
}

export interface KycRejectedEvent {
  user_id: string;
  kyc_id: string;
  reason: string;
  remaining_attempts: number;
}

export interface WalletFundedEvent {
  user_id: string;
  wallet_id: string;
  amount: string;
  currency: Currency;
  transaction_id: string;
}

export interface TradeExecutedEvent {
  trade_id: string;
  buyer_id: string;
  seller_id: string;
  bond_id: string;
  quantity: string;
  price: string;
  currency: Currency;
  buyer_order_id: string;
  seller_order_id: string;
}

export interface TradeSettledEvent {
  trade_id: string;
  buyer_id: string;
  seller_id: string;
  bond_id: string;
  settlement_date: string;
}

export interface CouponPaidEvent {
  user_id: string;
  bond_id: string;
  amount: string;
  currency: Currency;
  payment_date: string;
}
