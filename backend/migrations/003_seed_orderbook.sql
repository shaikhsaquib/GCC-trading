-- =============================================================================
-- GCC Bond Trading Platform — Order-Book Depth Seed (pure SQL)
--
-- Populates resting limit orders so every active bond shows a real order book
-- (5 bid levels below + 5 ask levels above the current price). Without this,
-- GET /orders/book/:bondId returns empty bids/asks and market orders are
-- rejected for "no liquidity".
--
-- HOW TO RUN: paste this whole file into the Supabase SQL Editor and Run.
-- No env vars or ts-node needed. Safe to re-run (idempotent).
--
-- It creates a "market maker" account that never logs in (so its auth fields
-- are deliberate placeholders), funds its wallet, gives it inventory, and
-- places the resting orders. Real user orders can match/settle against it.
-- =============================================================================

-- 1. Market-maker user (never logs in → auth columns are placeholders)
INSERT INTO app_auth.users
    (email, email_hash, phone, password_hash, first_name, last_name,
     nationality, date_of_birth, preferred_currency, role, status)
VALUES
    ('marketmaker@gcc.local', 'seed-marketmaker-hash', 'seed-mm-phone',
     'seed-no-login-not-a-real-hash', 'Market', 'Maker',
     'AE', '1985-01-01', 'AED', 'INVESTOR', 'ACTIVE')
ON CONFLICT (email_hash) DO NOTHING;

-- 2. Approved HIGH-tier KYC for the market maker (so risk limits never block it)
INSERT INTO kyc.submissions (user_id, status, risk_level)
SELECT u.id, 'Approved', 'HIGH'
FROM app_auth.users u
WHERE u.email_hash = 'seed-marketmaker-hash'
  AND NOT EXISTS (SELECT 1 FROM kyc.submissions k WHERE k.user_id = u.id);

-- 3. Fund the market-maker wallet (so its buy fills always have cash)
INSERT INTO wallet.wallets (user_id, currency, balance, available_balance, frozen_balance)
SELECT u.id, 'AED', 1000000000, 1000000000, 0
FROM app_auth.users u
WHERE u.email_hash = 'seed-marketmaker-hash'
ON CONFLICT (user_id) DO NOTHING;

-- 4. Give the market maker inventory in every active bond (so sell fills settle)
INSERT INTO portfolio.holdings (user_id, bond_id, quantity, avg_buy_price, current_value)
SELECT u.id, b.id, 100000, b.current_price, b.current_price * 100000
FROM app_auth.users u
CROSS JOIN bonds.listings b
WHERE u.email_hash = 'seed-marketmaker-hash'
  AND b.status = 'Active'
ON CONFLICT (user_id, bond_id) DO NOTHING;

-- 5. Resting orders — 5 bid levels (below) + 5 ask levels (above) per bond
--    Level n is 0.15%*n from the current price; size grows further out.
INSERT INTO trading.orders
    (user_id, bond_id, side, order_type, quantity, filled_quantity,
     price, status, idempotency_key)
SELECT
    u.id,
    b.id,
    s.side,
    'Limit',
    100 + (lvl.n - 1) * 60,                       -- 100,160,220,280,340 units
    0,
    CASE WHEN s.side = 'Buy'
         THEN ROUND((b.current_price * (1 - 0.0015 * lvl.n))::numeric, 4)
         ELSE ROUND((b.current_price * (1 + 0.0015 * lvl.n))::numeric, 4)
    END,
    'Open',
    'mm-' || b.id || '-' || lower(s.side) || '-' || lvl.n
FROM app_auth.users u
CROSS JOIN bonds.listings b
CROSS JOIN (VALUES ('Buy'), ('Sell')) AS s(side)
CROSS JOIN generate_series(1, 5) AS lvl(n)
WHERE u.email_hash = 'seed-marketmaker-hash'
  AND b.status = 'Active'
ON CONFLICT (idempotency_key) DO NOTHING;

-- Quick check (optional):
-- SELECT side, count(*) FROM trading.orders WHERE status='Open' GROUP BY side;
