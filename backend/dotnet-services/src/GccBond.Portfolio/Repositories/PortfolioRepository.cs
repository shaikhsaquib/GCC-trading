using Dapper;
using GccBond.Portfolio.Interfaces;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;

namespace GccBond.Portfolio.Repositories;

public class PortfolioRepository : IPortfolioRepository
{
    private readonly DatabaseHelper _db;

    public PortfolioRepository(DatabaseHelper db) => _db = db;

    public Task<IEnumerable<dynamic>> GetHoldingDetailsAsync(Guid userId)
        => _db.QueryAsync<dynamic>(@"
            SELECT
                h.bond_id,
                b.name           AS bond_name,
                b.isin,
                h.quantity,
                h.avg_buy_price,
                b.current_price,
                h.quantity * b.current_price                              AS current_value,
                (b.current_price - h.avg_buy_price) * h.quantity          AS unrealized_pnl,
                CASE WHEN h.avg_buy_price > 0
                    THEN ((b.current_price - h.avg_buy_price) / h.avg_buy_price) * 100
                    ELSE 0 END                                             AS unrealized_pnl_pct,
                h.total_coupon_received,
                b.maturity_date,
                b.coupon_frequency,
                b.coupon_rate
            FROM portfolio.holdings h
            JOIN bonds.listings b ON b.id = h.bond_id
            WHERE h.user_id = @UserId AND h.quantity > 0
            ORDER BY current_value DESC",
            new { UserId = userId });

    public Task<IEnumerable<PortfolioHolding>> GetRawHoldingsAsync(Guid userId)
        => _db.QueryAsync<PortfolioHolding>(
            "SELECT * FROM portfolio.holdings WHERE user_id = @UserId AND quantity > 0",
            new { UserId = userId });

    public Task<IEnumerable<dynamic>> GetCouponCalendarAsync(Guid userId)
        => _db.QueryAsync<dynamic>(@"
            SELECT
                cs.payment_date,
                cs.status,
                b.name AS bond_name,
                b.isin,
                h.quantity * (b.face_value * b.coupon_rate
                    / CASE b.coupon_frequency
                        WHEN 'Annual'     THEN 1
                        WHEN 'SemiAnnual' THEN 2
                        WHEN 'Quarterly'  THEN 4
                        ELSE 1 END)        AS expected_amount,
                b.currency
            FROM bonds.coupon_schedule cs
            JOIN bonds.listings b ON b.id = cs.bond_id
            JOIN portfolio.holdings h ON h.bond_id = b.id AND h.user_id = @UserId
            WHERE h.quantity > 0 AND cs.payment_date >= NOW()::date
            ORDER BY cs.payment_date ASC
            LIMIT 12",
            new { UserId = userId });

    public Task<IEnumerable<dynamic>> GetDueCouponsAsync(DateTime date)
        => _db.QueryAsync<dynamic>(@"
            SELECT b.id AS bond_id, b.face_value, b.coupon_rate, b.coupon_frequency, b.currency, b.name
            FROM bonds.coupon_schedule cs
            JOIN bonds.listings b ON b.id = cs.bond_id
            WHERE cs.payment_date = @Today AND cs.status = 'Pending' AND b.status = 'Active'",
            new { Today = date.Date });

    public Task<IEnumerable<dynamic>> GetHoldersByBondAsync(Guid bondId)
        => _db.QueryAsync<dynamic>(
            "SELECT user_id, quantity FROM portfolio.holdings WHERE bond_id = @BondId AND quantity > 0",
            new { BondId = bondId });

    public Task ProcessCouponPaymentAsync(Guid userId, Guid bondId, decimal amount, string currency, string bondName)
        => _db.TransactionAsync(async (conn, tx) =>
        {
            await conn.ExecuteAsync(@"
                UPDATE wallet.wallets
                SET available_balance = available_balance + @Amount,
                    balance = balance + @Amount, updated_at = NOW()
                WHERE user_id = @UserId",
                new { UserId = userId, Amount = amount }, tx);

            await conn.ExecuteAsync(@"
                INSERT INTO wallet.transactions
                    (id, wallet_id, type, amount, currency, status, reference_id,
                     description, idempotency_key, created_at)
                SELECT gen_random_uuid(), w.id, 'COUPON', @Amount, @Currency, 'COMPLETED',
                       @BondId, @Description, @IdempotencyKey, NOW()
                FROM wallet.wallets w WHERE w.user_id = @UserId",
                new
                {
                    UserId        = userId,
                    Amount        = amount,
                    Currency      = currency,
                    BondId        = bondId.ToString(),
                    Description   = $"Coupon payment: {bondName}",
                    IdempotencyKey= $"coupon-{bondId}-{DateTime.UtcNow:yyyyMMdd}-{userId}",
                }, tx);

            await conn.ExecuteAsync(@"
                UPDATE portfolio.holdings
                SET total_coupon_received = total_coupon_received + @Amount, updated_at = NOW()
                WHERE user_id = @UserId AND bond_id = @BondId",
                new { UserId = userId, BondId = bondId, Amount = amount }, tx);
        });

    public Task MarkCouponPaidAsync(Guid bondId, DateTime paymentDate)
        => _db.ExecuteAsync(@"
            UPDATE bonds.coupon_schedule
            SET status = 'Paid', paid_at = NOW()
            WHERE bond_id = @BondId AND payment_date = @Today",
            new { BondId = bondId, Today = paymentDate.Date });
}
