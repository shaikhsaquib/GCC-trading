-- =============================================================================
-- GCC Bond Trading Platform — Seed Data
-- Run after 001_initial_schema.sql
-- =============================================================================

-- ── Feature Flags (managed in Redis — this is just reference) ─────────────────
-- MAINTENANCE_MODE     = false
-- ENABLE_TRADING       = true
-- ENABLE_DEPOSITS      = true
-- ENABLE_WITHDRAWALS   = true

-- ── Sample Bond Listings ───────────────────────────────────────────────────────

INSERT INTO bonds.listings
    (id, isin, name, issuer_name, issuer_type, currency, face_value,
     coupon_rate, coupon_frequency, maturity_date, credit_rating,
     is_sharia_compliant, min_investment, current_price, status)
VALUES
    (gen_random_uuid(), 'AE000A1B2C3D', 'UAE Government Bond 2028',
     'Ministry of Finance UAE', 'Government', 'AED',
     1000.0000, 0.045000, 'SemiAnnual', '2028-12-31',
     'AA', FALSE, 1000.0000, 1023.5000, 'Active'),

    (gen_random_uuid(), 'AE000A1B2C3E', 'Emirates NBD Sukuk 2027',
     'Emirates NBD Bank', 'Corporate', 'AED',
     1000.0000, 0.052500, 'Annual', '2027-06-30',
     'A+', TRUE, 1000.0000, 1018.7500, 'Active'),

    (gen_random_uuid(), 'SA000A1B2C3F', 'Saudi Aramco Bond 2030',
     'Saudi Arabian Oil Co.', 'Corporate', 'SAR',
     1000.0000, 0.038750, 'SemiAnnual', '2030-03-15',
     'AA-', FALSE, 1000.0000, 987.2500, 'Active'),

    (gen_random_uuid(), 'KW000A1B2C3G', 'Kuwait Finance House Sukuk',
     'Kuwait Finance House', 'Corporate', 'KWD',
     1000.0000, 0.047500, 'SemiAnnual', '2026-09-30',
     'A', TRUE, 500.0000, 1004.1250, 'Active'),

    (gen_random_uuid(), 'QA000A1B2C3H', 'Qatar Government Bond 2032',
     'Ministry of Finance Qatar', 'Government', 'QAR',
     1000.0000, 0.042000, 'Annual', '2032-01-15',
     'AA', FALSE, 1000.0000, 1042.0000, 'Active')
ON CONFLICT (isin) DO NOTHING;

-- ── Coupon Schedules for sample bonds ─────────────────────────────────────────

-- UAE Gov Bond — SemiAnnual (Jun + Dec)
INSERT INTO bonds.coupon_schedule (bond_id, payment_date)
SELECT id, generate_series::date
FROM bonds.listings,
     generate_series('2024-06-30'::date, '2028-12-31'::date, '6 months'::interval)
WHERE isin = 'AE000A1B2C3D'
ON CONFLICT (bond_id, payment_date) DO NOTHING;

-- Emirates NBD Sukuk — Annual (Jun)
INSERT INTO bonds.coupon_schedule (bond_id, payment_date)
SELECT id, generate_series::date
FROM bonds.listings,
     generate_series('2024-06-30'::date, '2027-06-30'::date, '1 year'::interval)
WHERE isin = 'AE000A1B2C3E'
ON CONFLICT (bond_id, payment_date) DO NOTHING;

-- ── Initial Price History (last 30 days) ──────────────────────────────────────

INSERT INTO bonds.price_history (bond_id, price, recorded_at)
SELECT
    b.id,
    b.current_price * (1 + (random() - 0.5) * 0.02),  -- ±1% variation
    d::timestamptz
FROM bonds.listings b,
     generate_series(NOW() - INTERVAL '30 days', NOW(), '1 hour'::interval) AS d
ON CONFLICT DO NOTHING;
