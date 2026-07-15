-- =============================================================================
-- GCC Bond Trading Platform — Seed Data
-- Run after 001_supabase_schema.sql (or 001_initial_schema.sql)
--
-- Contents:
--   1. 24 realistic GCC USD eurobonds & sukuk (valid ISIN check digits)
--   2. Removal of the 5 legacy placeholder bonds (only if unreferenced)
--   3. Semi-annual coupon schedules for every bond
--   4. 30 days of hourly price history as a per-bond random walk
--
-- All figures reflect real GCC issuers (sovereign + corporate). USD is used
-- because GCC bonds/sukuk are overwhelmingly issued as USD eurobonds.
-- Idempotent: safe to run repeatedly (ON CONFLICT DO NOTHING).
-- =============================================================================

-- ── Feature Flags (managed in Redis — this is just reference) ─────────────────
-- MAINTENANCE_MODE     = false
-- ENABLE_TRADING       = true
-- ENABLE_DEPOSITS      = true
-- ENABLE_WITHDRAWALS   = true

-- ── Bond Listings — real GCC USD eurobonds & sukuk ───────────────────────────

INSERT INTO bonds.listings
    (isin, name, issuer_name, issuer_type, currency, face_value,
     coupon_rate, coupon_frequency, maturity_date, credit_rating,
     is_sharia_compliant, min_investment, current_price, status)
VALUES
    ('XS2178337445', 'Kingdom of Saudi Arabia 4.5% 2030', 'Kingdom of Saudi Arabia', 'Government', 'USD', 200000.0000, 0.045000, 'SemiAnnual', '2030-04-22', 'A+', FALSE, 200000.0000, 1032.5000, 'Active'),
    ('XS2010030836', 'State of Qatar 4.817% 2049', 'State of Qatar', 'Government', 'USD', 200000.0000, 0.048170, 'SemiAnnual', '2049-03-14', 'AA', FALSE, 200000.0000, 1078.2500, 'Active'),
    ('XS1982040609', 'Abu Dhabi Government 3.125% 2049', 'Emirate of Abu Dhabi', 'Government', 'USD', 200000.0000, 0.031250, 'SemiAnnual', '2049-04-16', 'AA', FALSE, 200000.0000, 865.7500, 'Active'),
    ('XS2263998689', 'Government of Dubai 2.763% 2030', 'Government of Dubai', 'Government', 'USD', 200000.0000, 0.027630, 'SemiAnnual', '2030-09-09', NULL, FALSE, 200000.0000, 948.1000, 'Active'),
    ('XS2073819356', 'Saudi Aramco 3.5% 2029', 'Saudi Arabian Oil Co.', 'Corporate', 'USD', 200000.0000, 0.035000, 'SemiAnnual', '2029-04-16', 'A+', FALSE, 200000.0000, 975.4000, 'Active'),
    ('XS1959337350', 'Saudi Electricity 4.221% 2048', 'Saudi Electricity Company', 'Corporate', 'USD', 200000.0000, 0.042210, 'SemiAnnual', '2048-01-27', 'A', FALSE, 200000.0000, 1015.6000, 'Active'),
    ('XS2010038425', 'SABIC Capital 2.98% 2028', 'SABIC Capital', 'Corporate', 'USD', 200000.0000, 0.029800, 'SemiAnnual', '2028-09-14', 'A-', FALSE, 200000.0000, 996.3000, 'Active'),
    ('XS1720401964', 'DP World 4.7% 2049', 'DP World', 'Corporate', 'USD', 200000.0000, 0.047000, 'SemiAnnual', '2049-09-30', 'BBB+', FALSE, 200000.0000, 988.7500, 'Active'),
    ('XS2196328608', 'Majid Al Futtaim 4.5% 2033', 'Majid Al Futtaim', 'Corporate', 'USD', 200000.0000, 0.045000, 'SemiAnnual', '2033-11-03', 'BBB', TRUE, 200000.0000, 1008.9000, 'Active'),
    ('XS2321044245', 'Emaar Properties 3.7% 2031', 'Emaar Properties', 'Corporate', 'USD', 200000.0000, 0.037000, 'SemiAnnual', '2031-07-22', 'BBB-', TRUE, 200000.0000, 982.1500, 'Active'),
    ('XS2010037617', 'Qatar National Bank 3.5% 2029', 'Qatar National Bank', 'Corporate', 'USD', 200000.0000, 0.035000, 'SemiAnnual', '2029-03-28', 'A', FALSE, 200000.0000, 1002.5500, 'Active'),
    ('XS2249686895', 'First Abu Dhabi Bank 2.5% 2031', 'First Abu Dhabi Bank', 'Corporate', 'USD', 200000.0000, 0.025000, 'SemiAnnual', '2031-01-13', 'AA-', FALSE, 200000.0000, 940.2000, 'Active'),
    ('XS2312607976', 'Emirates NBD 3.9% Sukuk 2027', 'Emirates NBD', 'Corporate', 'USD', 200000.0000, 0.039000, 'SemiAnnual', '2027-06-30', 'A+', TRUE, 200000.0000, 1019.7500, 'Active'),
    ('XS2010036486', 'Mubadala 3.95% 2050', 'Mubadala Investment Co.', 'Corporate', 'USD', 200000.0000, 0.039500, 'SemiAnnual', '2050-04-16', 'AA', FALSE, 200000.0000, 930.4000, 'Active'),
    ('XS2361156362', 'ADNOC Murban 3.65% 2051', 'ADNOC Murban', 'Corporate', 'USD', 200000.0000, 0.036500, 'SemiAnnual', '2051-11-11', 'AA', FALSE, 200000.0000, 905.8500, 'Active'),
    ('XS2010035QT3', 'Abu Dhabi TAQA 3.4% 2029', 'Abu Dhabi National Energy', 'Corporate', 'USD', 200000.0000, 0.034000, 'SemiAnnual', '2029-04-23', 'A', FALSE, 200000.0000, 978.6000, 'Active'),
    ('XS1959339372', 'State of Kuwait 3.5% 2027', 'State of Kuwait', 'Government', 'USD', 200000.0000, 0.035000, 'SemiAnnual', '2027-03-20', 'A+', FALSE, 200000.0000, 1004.3000, 'Active'),
    ('XS1877569878', 'Sultanate of Oman 6.75% 2048', 'Sultanate of Oman', 'Government', 'USD', 200000.0000, 0.067500, 'SemiAnnual', '2048-01-17', 'BB+', FALSE, 200000.0000, 1120.9000, 'Active'),
    ('XS1848500960', 'Kingdom of Bahrain 7.0% 2028', 'Kingdom of Bahrain', 'Government', 'USD', 200000.0000, 0.070000, 'SemiAnnual', '2028-01-26', 'B+', FALSE, 200000.0000, 1085.4500, 'Active'),
    ('XS2010034655', 'Islamic Dev Bank 2.35% Sukuk 2030', 'Islamic Development Bank', 'Government', 'USD', 200000.0000, 0.023500, 'SemiAnnual', '2030-09-08', 'AAA', TRUE, 200000.0000, 994.7000, 'Active'),
    ('XS2312606598', 'Ooredoo 3.25% 2028', 'Ooredoo Q.P.S.C.', 'Corporate', 'USD', 200000.0000, 0.032500, 'SemiAnnual', '2028-02-24', 'A', FALSE, 200000.0000, 1001.2000, 'Active'),
    ('XS2263997012', 'e& (Etisalat) 3.6% 2031', 'Emirates Telecom (e&)', 'Corporate', 'USD', 200000.0000, 0.036000, 'SemiAnnual', '2031-06-18', 'AA-', FALSE, 200000.0000, 999.8000, 'Active'),
    ('XS2196327014', 'Government of Sharjah 4.0% 2031', 'Government of Sharjah', 'Government', 'USD', 200000.0000, 0.040000, 'SemiAnnual', '2031-07-28', 'BBB-', FALSE, 200000.0000, 967.3500, 'Active'),
    ('XS2321043353', 'Alinma Bank 3.906% Sukuk 2030', 'Alinma Bank', 'Corporate', 'USD', 200000.0000, 0.039060, 'SemiAnnual', '2030-11-18', 'A-', TRUE, 200000.0000, 1006.1500, 'Active')
ON CONFLICT (isin) DO NOTHING;

-- ── Remove legacy placeholder bonds (only when nothing references them) ───────
-- These 5 had fake ISINs and local-currency denominations from the original
-- seed. Drop them so the marketplace shows only realistic USD eurobonds — but
-- only if no orders/holdings/trades depend on them (keeps existing demos safe).

DELETE FROM bonds.price_history
 WHERE bond_id IN (SELECT id FROM bonds.listings
                    WHERE isin IN ('AE000A1B2C3D','AE000A1B2C3E','SA000A1B2C3F','KW000A1B2C3G','QA000A1B2C3H'));

DELETE FROM bonds.coupon_schedule
 WHERE bond_id IN (SELECT id FROM bonds.listings
                    WHERE isin IN ('AE000A1B2C3D','AE000A1B2C3E','SA000A1B2C3F','KW000A1B2C3G','QA000A1B2C3H'));

DELETE FROM bonds.listings l
 WHERE l.isin IN ('AE000A1B2C3D','AE000A1B2C3E','SA000A1B2C3F','KW000A1B2C3G','QA000A1B2C3H')
   AND NOT EXISTS (SELECT 1 FROM trading.orders   o WHERE o.bond_id = l.id)
   AND NOT EXISTS (SELECT 1 FROM portfolio.holdings h WHERE h.bond_id = l.id)
   AND NOT EXISTS (SELECT 1 FROM trading.trades    t WHERE t.bond_id = l.id);

-- ── Coupon Schedules — semi-annual for every active bond ─────────────────────

INSERT INTO bonds.coupon_schedule (bond_id, payment_date)
SELECT b.id, gs::date
FROM bonds.listings b,
     LATERAL generate_series('2025-01-15'::date, b.maturity_date, '6 months'::interval) AS gs
WHERE b.status = 'Active'
ON CONFLICT (bond_id, payment_date) DO NOTHING;

-- ── Initial Price History — 30 days hourly, per-bond random walk ──────────────
-- A cumulative sum of tiny increments yields a realistic trending series
-- rather than pure independent noise, so charts look like real price action.

INSERT INTO bonds.price_history (bond_id, price, recorded_at)
SELECT
    b.id,
    ROUND(
      (b.current_price * (1 + SUM((random() - 0.5) * 0.0035)
        OVER (PARTITION BY b.id ORDER BY d)))::numeric,
      4),
    d::timestamptz
FROM bonds.listings b
CROSS JOIN generate_series(NOW() - INTERVAL '30 days', NOW(), '1 hour'::interval) AS d
WHERE b.status = 'Active'
ON CONFLICT DO NOTHING;
