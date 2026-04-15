using Dapper;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using Serilog;

namespace GccBond.Portfolio.Services;

public record PortfolioSummary
{
    public decimal                     TotalValue          { get; init; }
    public decimal                     TotalCost           { get; init; }
    public decimal                     TotalUnrealizedPnl  { get; init; }
    public decimal                     TotalCouponReceived { get; init; }
    public decimal                     PnlPercentage       { get; init; }
    public IEnumerable<HoldingDetail>  Holdings            { get; init; } = [];
}

public record HoldingDetail
{
    public Guid    BondId              { get; init; }
    public string  BondName            { get; init; } = "";
    public string  Isin                { get; init; } = "";
    public decimal Quantity            { get; init; }
    public decimal AvgBuyPrice         { get; init; }
    public decimal CurrentPrice        { get; init; }
    public decimal CurrentValue        { get; init; }
    public decimal UnrealizedPnl       { get; init; }
    public decimal UnrealizedPnlPct    { get; init; }
    public decimal TotalCouponReceived { get; init; }
    public DateTime MaturityDate       { get; init; }
    public string  CouponFrequency     { get; init; } = "";
    public decimal CouponRate          { get; init; }
    public decimal Allocation          { get; init; } // % of portfolio
}

public class PortfolioService
{
    private readonly DatabaseHelper _db;
    private readonly IEventBus      _eventBus;

    public PortfolioService(DatabaseHelper db, IEventBus eventBus)
    {
        _db       = db;
        _eventBus = eventBus;
    }

    // ── Portfolio Summary ──────────────────────────────────────────────────────

    public async Task<PortfolioSummary> GetSummaryAsync(Guid userId)
    {
        var holdings = await GetHoldingDetailsAsync(userId);
        var list     = holdings.ToList();

        var totalValue   = list.Sum(h => h.CurrentValue);
        var totalCost    = list.Sum(h => h.Quantity * h.AvgBuyPrice);
        var totalPnl     = list.Sum(h => h.UnrealizedPnl);
        var totalCoupons = list.Sum(h => h.TotalCouponReceived);
        var pnlPct       = totalCost > 0 ? Math.Round(totalPnl / totalCost * 100, 2) : 0;

        // Add allocation percentage
        var withAllocation = list.Select(h => h with
        {
            Allocation = totalValue > 0 ? Math.Round(h.CurrentValue / totalValue * 100, 2) : 0,
        }).ToList();

        return new PortfolioSummary
        {
            TotalValue          = totalValue,
            TotalCost           = totalCost,
            TotalUnrealizedPnl  = totalPnl,
            TotalCouponReceived = totalCoupons,
            PnlPercentage       = pnlPct,
            Holdings            = withAllocation,
        };
    }

    private async Task<IEnumerable<HoldingDetail>> GetHoldingDetailsAsync(Guid userId)
    {
        return await _db.QueryAsync<HoldingDetail>(@"
            SELECT
                h.bond_id,
                b.name           AS bond_name,
                b.isin,
                h.quantity,
                h.avg_buy_price,
                b.current_price,
                h.quantity * b.current_price          AS current_value,
                (b.current_price - h.avg_buy_price)
                    * h.quantity                      AS unrealized_pnl,
                CASE WHEN h.avg_buy_price > 0
                    THEN ((b.current_price - h.avg_buy_price) / h.avg_buy_price) * 100
                    ELSE 0 END                        AS unrealized_pnl_pct,
                h.total_coupon_received,
                b.maturity_date,
                b.coupon_frequency,
                b.coupon_rate
            FROM portfolio.holdings h
            JOIN bonds.listings b ON b.id = h.bond_id
            WHERE h.user_id = @UserId AND h.quantity > 0
            ORDER BY current_value DESC",
            new { UserId = userId });
    }

    // ── Coupon Distribution ────────────────────────────────────────────────────

    /// <summary>
    /// Called by scheduler — processes coupon payments for all eligible holders.
    /// Frequency: Annual/SemiAnnual/Quarterly based on bond schedule.
    /// </summary>
    public async Task ProcessCouponPaymentsAsync()
    {
        Log.Information("Processing coupon payments for {Date}", DateTime.UtcNow.Date);

        // Find bonds with coupon payments due today
        var dueBonds = await _db.QueryAsync<dynamic>(@"
            SELECT b.id AS bond_id, b.face_value, b.coupon_rate, b.coupon_frequency,
                   b.currency, b.name
            FROM bonds.coupon_schedule cs
            JOIN bonds.listings b ON b.id = cs.bond_id
            WHERE cs.payment_date = @Today AND cs.status = 'Pending'
              AND b.status = 'Active'",
            new { Today = DateTime.UtcNow.Date });

        foreach (var bond in dueBonds)
        {
            await ProcessBondCouponAsync(bond);
        }
    }

    private async Task ProcessBondCouponAsync(dynamic bond)
    {
        // Get all holders of this bond
        var holders = await _db.QueryAsync<dynamic>(@"
            SELECT user_id, quantity
            FROM portfolio.holdings
            WHERE bond_id = @BondId AND quantity > 0",
            new { BondId = (Guid)bond.bond_id });

        decimal couponPerUnit = Math.Round(
            (decimal)bond.face_value * (decimal)bond.coupon_rate
            / GetPaymentsPerYear((string)bond.coupon_frequency), 4);

        foreach (var holder in holders)
        {
            decimal couponAmount = couponPerUnit * (decimal)holder.quantity;

            await _db.TransactionAsync(async (conn, tx) =>
            {
                // Credit holder's wallet
                await conn.ExecuteAsync(@"
                    UPDATE wallet.wallets
                    SET available_balance = available_balance + @Amount,
                        balance           = balance           + @Amount,
                        updated_at        = NOW()
                    WHERE user_id = @UserId",
                    new { UserId = (Guid)holder.user_id, Amount = couponAmount }, tx);

                // Record transaction
                await conn.ExecuteAsync(@"
                    INSERT INTO wallet.transactions
                        (id, wallet_id, type, amount, currency, status, reference_id,
                         description, idempotency_key, created_at)
                    SELECT gen_random_uuid(), w.id, 'COUPON', @Amount, @Currency, 'COMPLETED',
                           @BondId, @Description, @IdempotencyKey, NOW()
                    FROM wallet.wallets w WHERE w.user_id = @UserId",
                    new
                    {
                        UserId        = (Guid)holder.user_id,
                        Amount        = couponAmount,
                        Currency      = (string)bond.currency,
                        BondId        = bond.bond_id.ToString(),
                        Description   = $"Coupon payment: {bond.name}",
                        IdempotencyKey= $"coupon-{bond.bond_id}-{DateTime.UtcNow:yyyyMMdd}-{holder.user_id}",
                    }, tx);

                // Update total coupon received in holding
                await conn.ExecuteAsync(@"
                    UPDATE portfolio.holdings
                    SET total_coupon_received = total_coupon_received + @Amount,
                        updated_at            = NOW()
                    WHERE user_id = @UserId AND bond_id = @BondId",
                    new { UserId = (Guid)holder.user_id, BondId = (Guid)bond.bond_id, Amount = couponAmount }, tx);
            });

            // Publish event so Node.js sends notification
            await _eventBus.PublishAsync(Events.CouponPaid, new
            {
                user_id   = holder.user_id.ToString(),
                bond_id   = bond.bond_id.ToString(),
                amount    = couponAmount.ToString("F4"),
                currency  = (string)bond.currency,
            });
        }

        // Mark coupon schedule entry as paid
        await _db.ExecuteAsync(@"
            UPDATE bonds.coupon_schedule
            SET status = 'Paid', paid_at = NOW()
            WHERE bond_id = @BondId AND payment_date = @Today",
            new { BondId = (Guid)bond.bond_id, Today = DateTime.UtcNow.Date });

        Log.Information("Coupon processed for bond {BondId}: {Count} holders", bond.bond_id, holders.Count());
    }

    // ── Holdings CRUD ──────────────────────────────────────────────────────────

    public async Task<IEnumerable<PortfolioHolding>> GetRawHoldingsAsync(Guid userId)
        => await _db.QueryAsync<PortfolioHolding>(
            "SELECT * FROM portfolio.holdings WHERE user_id = @UserId AND quantity > 0",
            new { UserId = userId });

    public async Task<IEnumerable<dynamic>> GetCouponCalendarAsync(Guid userId)
        => await _db.QueryAsync<dynamic>(@"
            SELECT
                cs.payment_date,
                cs.status,
                b.name AS bond_name,
                b.isin,
                h.quantity * (b.face_value * b.coupon_rate / @PaymentsPerYear) AS expected_amount,
                b.currency
            FROM bonds.coupon_schedule cs
            JOIN bonds.listings b ON b.id = cs.bond_id
            JOIN portfolio.holdings h ON h.bond_id = b.id AND h.user_id = @UserId
            WHERE h.quantity > 0
              AND cs.payment_date >= NOW()::date
            ORDER BY cs.payment_date ASC
            LIMIT 12",
            new { UserId = userId, PaymentsPerYear = 1 }); // simplified

    private static int GetPaymentsPerYear(string frequency)
        => frequency switch
        {
            "Annual"     => 1,
            "SemiAnnual" => 2,
            "Quarterly"  => 4,
            _            => 1,
        };
}
