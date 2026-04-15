-- =============================================================================
-- GCC Bond Trading Platform — Master Database Schema
-- FSD §6 — Database Schema Design
-- Run order: this file first, then seed files.
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- ILIKE performance
CREATE EXTENSION IF NOT EXISTS "timescaledb"; -- price history

-- =============================================================================
-- SCHEMA: auth  (users, sessions, password resets)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT         NOT NULL,               -- AES-256 encrypted
    phone               TEXT         NOT NULL,               -- AES-256 encrypted
    email_hash          TEXT         NOT NULL UNIQUE,        -- SHA-256 for duplicate detection
    password_hash       TEXT         NOT NULL,               -- bcrypt cost 12
    first_name          TEXT         NOT NULL,
    last_name           TEXT         NOT NULL,
    name_normalized     TEXT         GENERATED ALWAYS AS (lower(first_name || ' ' || last_name)) STORED,
    nationality         CHAR(2)      NOT NULL,               -- ISO 3166-1 alpha-2
    date_of_birth       DATE         NOT NULL,
    role                TEXT         NOT NULL DEFAULT 'INVESTOR' CHECK (role IN ('INVESTOR','KYC_OFFICER','L2_ADMIN','ADMIN','COMPLIANCE')),
    status              TEXT         NOT NULL DEFAULT 'PENDING_KYC' CHECK (status IN ('PENDING_KYC','ACTIVE','SUSPENDED','DEACTIVATED')),
    preferred_currency  TEXT         NOT NULL DEFAULT 'AED' CHECK (preferred_currency IN ('AED','SAR','KWD','QAR','OMR','BHD','USD')),
    totp_secret         TEXT,
    totp_enabled        BOOLEAN      NOT NULL DEFAULT FALSE,
    failed_login_count  INTEGER      NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email_hash    ON auth.users (email_hash);
CREATE INDEX IF NOT EXISTS idx_users_status        ON auth.users (status);
CREATE INDEX IF NOT EXISTS idx_users_role          ON auth.users (role);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm     ON auth.users USING GIN (name_normalized gin_trgm_ops);

CREATE TABLE IF NOT EXISTS auth.password_resets (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SCHEMA: kyc  (submissions, documents)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS kyc;

CREATE TABLE IF NOT EXISTS kyc.submissions (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status              TEXT        NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','UnderReview','Approved','Rejected')),
    risk_level          TEXT        CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
    onfido_applicant_id TEXT,
    onfido_check_id     TEXT,
    liveness_score      DECIMAL(5,4),
    submission_count    INTEGER     NOT NULL DEFAULT 0,
    reviewer_id         UUID        REFERENCES auth.users(id),
    review_notes        TEXT,
    reviewed_at         TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc.submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status  ON kyc.submissions (status);

CREATE TABLE IF NOT EXISTS kyc.documents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID        NOT NULL REFERENCES kyc.submissions(id) ON DELETE CASCADE,
    document_type   TEXT        NOT NULL CHECK (document_type IN ('PASSPORT','NATIONAL_ID','DRIVING_LICENSE','PROOF_OF_ADDRESS','SELFIE','LIVENESS_VIDEO')),
    mongo_doc_id    TEXT        NOT NULL,   -- MongoDB _id where encrypted file is stored
    file_name       TEXT        NOT NULL,
    mime_type       TEXT        NOT NULL,
    file_size_bytes INTEGER     NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SCHEMA: wallet  (wallets, transactions, withdrawal requests)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS wallet;

CREATE TABLE IF NOT EXISTS wallet.wallets (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL UNIQUE REFERENCES auth.users(id),
    currency            TEXT         NOT NULL DEFAULT 'AED',
    balance             DECIMAL(18,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    available_balance   DECIMAL(18,4) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
    frozen_balance      DECIMAL(18,4) NOT NULL DEFAULT 0 CHECK (frozen_balance >= 0),
    version             INTEGER      NOT NULL DEFAULT 0,   -- optimistic locking
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet.transactions (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID         NOT NULL REFERENCES wallet.wallets(id),
    type            TEXT         NOT NULL CHECK (type IN ('CREDIT','DEBIT','FREEZE','UNFREEZE','COUPON','SETTLEMENT_CREDIT','SETTLEMENT_DEBIT')),
    amount          DECIMAL(18,4) NOT NULL CHECK (amount > 0),
    currency        TEXT         NOT NULL,
    status          TEXT         NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED','FAILED','REVERSED')),
    reference_id    TEXT,                -- trade_id, transaction_id, etc.
    description     TEXT,
    hyperpay_id     TEXT,
    idempotency_key TEXT         NOT NULL UNIQUE,
    metadata        JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet  ON wallet.transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_idem    ON wallet.transactions (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_status  ON wallet.transactions (status);

CREATE TABLE IF NOT EXISTS wallet.withdrawal_requests (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL REFERENCES auth.users(id),
    amount          DECIMAL(18,4) NOT NULL CHECK (amount > 0),
    currency        TEXT         NOT NULL,
    bank_name       TEXT         NOT NULL,
    iban            TEXT         NOT NULL,
    status          TEXT         NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','PROCESSING','COMPLETED','FAILED')),
    maker_id        UUID         REFERENCES auth.users(id),
    checker_id      UUID         REFERENCES auth.users(id),
    checker_notes   TEXT,
    checked_at      TIMESTAMPTZ,
    hyperpay_payout_id TEXT,
    idempotency_key TEXT         NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SCHEMA: bonds  (listings, price history, coupon schedule)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS bonds;

CREATE TABLE IF NOT EXISTS bonds.listings (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    isin                CHAR(12)      NOT NULL UNIQUE,
    name                TEXT          NOT NULL,
    issuer_name         TEXT          NOT NULL,
    issuer_type         TEXT          NOT NULL CHECK (issuer_type IN ('Government','Corporate')),
    currency            TEXT          NOT NULL DEFAULT 'AED',
    face_value          DECIMAL(18,4) NOT NULL CHECK (face_value > 0),
    coupon_rate         DECIMAL(8,6)  NOT NULL CHECK (coupon_rate >= 0 AND coupon_rate <= 1),
    coupon_frequency    TEXT          NOT NULL CHECK (coupon_frequency IN ('Annual','SemiAnnual','Quarterly')),
    maturity_date       DATE          NOT NULL,
    credit_rating       TEXT,
    is_sharia_compliant BOOLEAN       NOT NULL DEFAULT FALSE,
    min_investment      DECIMAL(18,4) NOT NULL DEFAULT 1000,
    current_price       DECIMAL(18,4) NOT NULL CHECK (current_price > 0),
    status              TEXT          NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Delisted','Matured')),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonds_status    ON bonds.listings (status);
CREATE INDEX IF NOT EXISTS idx_bonds_isin      ON bonds.listings (isin);
CREATE INDEX IF NOT EXISTS idx_bonds_issuer    ON bonds.listings (issuer_type);
CREATE INDEX IF NOT EXISTS idx_bonds_sharia    ON bonds.listings (is_sharia_compliant);
CREATE INDEX IF NOT EXISTS idx_bonds_name_trgm ON bonds.listings USING GIN (name gin_trgm_ops);

-- TimescaleDB hypertable for price history
CREATE TABLE IF NOT EXISTS bonds.price_history (
    bond_id     UUID          NOT NULL REFERENCES bonds.listings(id),
    price       DECIMAL(18,4) NOT NULL,
    recorded_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('bonds.price_history', 'recorded_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_price_history_bond ON bonds.price_history (bond_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS bonds.coupon_schedule (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    bond_id      UUID        NOT NULL REFERENCES bonds.listings(id),
    payment_date DATE        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Paid','Skipped')),
    paid_at      TIMESTAMPTZ,
    UNIQUE (bond_id, payment_date)
);

CREATE INDEX IF NOT EXISTS idx_coupon_schedule_date ON bonds.coupon_schedule (payment_date, status);

-- =============================================================================
-- SCHEMA: trading  (orders, trades)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS trading;

CREATE TABLE IF NOT EXISTS trading.orders (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID          NOT NULL REFERENCES auth.users(id),
    bond_id         UUID          NOT NULL REFERENCES bonds.listings(id),
    side            TEXT          NOT NULL CHECK (side IN ('Buy','Sell')),
    order_type      TEXT          NOT NULL CHECK (order_type IN ('Market','Limit')),
    quantity        DECIMAL(18,4) NOT NULL CHECK (quantity > 0),
    filled_quantity DECIMAL(18,4) NOT NULL DEFAULT 0 CHECK (filled_quantity >= 0),
    price           DECIMAL(18,4) CHECK (price > 0),          -- NULL for market orders
    avg_fill_price  DECIMAL(18,4),
    status          TEXT          NOT NULL DEFAULT 'Open' CHECK (status IN (
                        'PendingValidation','Validated','Rejected','Open',
                        'PartiallyFilled','Filled','Cancelled','Expired',
                        'PendingSettlement','Settled','SettlementFailed')),
    expires_at      TIMESTAMPTZ,
    cancel_reason   TEXT,
    idempotency_key TEXT          NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user      ON trading.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_bond_book ON trading.orders (bond_id, side, status, price, created_at)
    WHERE status IN ('Open', 'PartiallyFilled');
CREATE INDEX IF NOT EXISTS idx_orders_status    ON trading.orders (status);

CREATE TABLE IF NOT EXISTS trading.trades (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    buy_order_id    UUID          NOT NULL REFERENCES trading.orders(id),
    sell_order_id   UUID          NOT NULL REFERENCES trading.orders(id),
    buyer_id        UUID          NOT NULL REFERENCES auth.users(id),
    seller_id       UUID          NOT NULL REFERENCES auth.users(id),
    bond_id         UUID          NOT NULL REFERENCES bonds.listings(id),
    quantity        DECIMAL(18,4) NOT NULL CHECK (quantity > 0),
    price           DECIMAL(18,4) NOT NULL CHECK (price > 0),
    buyer_fee       DECIMAL(18,4) NOT NULL DEFAULT 0,
    seller_fee      DECIMAL(18,4) NOT NULL DEFAULT 0,
    settlement_fee  DECIMAL(18,4) NOT NULL DEFAULT 0,
    executed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_buyer    ON trading.trades (buyer_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_seller   ON trading.trades (seller_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_bond     ON trading.trades (bond_id, executed_at DESC);

-- =============================================================================
-- SCHEMA: settlement
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS settlement;

CREATE TABLE IF NOT EXISTS settlement.settlements (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id        UUID        NOT NULL UNIQUE REFERENCES trading.trades(id),
    status          TEXT        NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Processing','Reconciling','Completed','Failed')),
    trade_date      DATE        NOT NULL,
    settlement_date DATE        NOT NULL,
    retry_count     INTEGER     NOT NULL DEFAULT 0,
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlement.settlements (status, settlement_date);

-- =============================================================================
-- SCHEMA: portfolio
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS portfolio;

CREATE TABLE IF NOT EXISTS portfolio.holdings (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID          NOT NULL REFERENCES auth.users(id),
    bond_id                 UUID          NOT NULL REFERENCES bonds.listings(id),
    quantity                DECIMAL(18,4) NOT NULL CHECK (quantity >= 0),
    avg_buy_price           DECIMAL(18,4) NOT NULL DEFAULT 0,
    current_value           DECIMAL(18,4) NOT NULL DEFAULT 0,
    unrealized_pnl          DECIMAL(18,4) NOT NULL DEFAULT 0,
    total_coupon_received   DECIMAL(18,4) NOT NULL DEFAULT 0,
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, bond_id)
);

CREATE INDEX IF NOT EXISTS idx_holdings_user ON portfolio.holdings (user_id);

-- =============================================================================
-- SCHEMA: aml  (alerts, sanctions list)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS aml;

CREATE TABLE IF NOT EXISTS aml.alerts (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          NOT NULL REFERENCES auth.users(id),
    rule_code   TEXT          NOT NULL,
    description TEXT          NOT NULL,
    severity    TEXT          NOT NULL CHECK (severity IN ('Low','Medium','High','Critical')),
    status      TEXT          NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','UnderReview','Escalated','Cleared','SarFiled')),
    amount      DECIMAL(18,4) NOT NULL DEFAULT 0,
    currency    TEXT          NOT NULL DEFAULT 'AED',
    sar_ref     TEXT,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_user   ON aml.alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_aml_alerts_status ON aml.alerts (status);

CREATE TABLE IF NOT EXISTS aml.sanctions_list (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    name_normalized TEXT        NOT NULL,
    list_source     TEXT        NOT NULL CHECK (list_source IN ('OFAC','UN','EU','LOCAL')),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanctions_name ON aml.sanctions_list (name_normalized);

-- =============================================================================
-- Hangfire schema (Settlement service uses it)
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS hangfire;

-- =============================================================================
-- Updated_at trigger function (shared)
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT table_schema, table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
          AND table_schema IN ('auth','kyc','wallet','bonds','trading','settlement','portfolio','aml')
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON %I.%I;
             CREATE TRIGGER set_updated_at
             BEFORE UPDATE ON %I.%I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
            t.table_schema, t.table_name,
            t.table_schema, t.table_name
        );
    END LOOP;
END;
$$;
