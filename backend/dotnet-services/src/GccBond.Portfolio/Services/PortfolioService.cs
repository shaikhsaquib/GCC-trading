using GccBond.Shared.Interfaces;
using GccBond.Portfolio.DTOs;
using GccBond.Portfolio.Interfaces;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using Serilog;

namespace GccBond.Portfolio.Services;

/// <summary>
/// Portfolio business logic (FSD §6.3).
/// No SQL — all data access goes through IPortfolioRepository.
/// </summary>
public class PortfolioService : IPortfolioService
{
    private readonly IPortfolioRepository _repo;
    private readonly IEventBus            _eventBus;

    public PortfolioService(IPortfolioRepository repo, IEventBus eventBus)
    {
        _repo     = repo;
        _eventBus = eventBus;
    }

    public async Task<PortfolioSummaryResponse> GetSummaryAsync(Guid userId)
    {
        var raw  = await _repo.GetHoldingDetailsAsync(userId);
        var list = raw.Select(h => new HoldingDetailResponse
        {
            BondId              = (Guid)h.bond_id,
            BondName            = (string)h.bond_name,
            Isin                = (string)h.isin,
            Quantity            = (decimal)h.quantity,
            AvgBuyPrice         = (decimal)h.avg_buy_price,
            CurrentPrice        = (decimal)h.current_price,
            CurrentValue        = (decimal)h.current_value,
            UnrealizedPnl       = (decimal)h.unrealized_pnl,
            UnrealizedPnlPct    = (decimal)h.unrealized_pnl_pct,
            TotalCouponReceived = (decimal)h.total_coupon_received,
            MaturityDate        = (DateTime)h.maturity_date,
            CouponFrequency     = (string)h.coupon_frequency,
            CouponRate          = (decimal)h.coupon_rate,
        }).ToList();

        var totalValue  = list.Sum(h => h.CurrentValue);
        var totalCost   = list.Sum(h => h.Quantity * h.AvgBuyPrice);
        var totalPnl    = list.Sum(h => h.UnrealizedPnl);
        var totalCoupons= list.Sum(h => h.TotalCouponReceived);
        var pnlPct      = totalCost > 0 ? Math.Round(totalPnl / totalCost * 100, 2) : 0;

        var withAlloc = list.Select(h => h with
        {
            Allocation = totalValue > 0 ? Math.Round(h.CurrentValue / totalValue * 100, 2) : 0,
        }).ToList();

        return new PortfolioSummaryResponse
        {
            TotalValue          = totalValue,
            TotalCost           = totalCost,
            TotalUnrealizedPnl  = totalPnl,
            TotalCouponReceived = totalCoupons,
            PnlPercentage       = pnlPct,
            Holdings            = withAlloc,
        };
    }

    public Task<IEnumerable<PortfolioHolding>> GetHoldingsAsync(Guid userId)
        => _repo.GetRawHoldingsAsync(userId);

    public Task<IEnumerable<dynamic>> GetCouponCalendarAsync(Guid userId)
        => _repo.GetCouponCalendarAsync(userId);

    public async Task ProcessCouponPaymentsAsync()
    {
        Log.Information("Processing coupon payments for {Date}", DateTime.UtcNow.Date);

        var dueBonds = await _repo.GetDueCouponsAsync(DateTime.UtcNow);

        foreach (var bond in dueBonds)
        {
            var holders = await _repo.GetHoldersByBondAsync((Guid)bond.bond_id);
            var m = GetPaymentsPerYear((string)bond.coupon_frequency);
            var couponPerUnit = Math.Round((decimal)bond.face_value * (decimal)bond.coupon_rate / m, 4);

            foreach (var holder in holders)
            {
                var amount = couponPerUnit * (decimal)holder.quantity;
                await _repo.ProcessCouponPaymentAsync(
                    (Guid)holder.user_id, (Guid)bond.bond_id,
                    amount, (string)bond.currency, (string)bond.name);

                await _eventBus.PublishAsync(Events.CouponPaid, new
                {
                    user_id  = holder.user_id.ToString(),
                    bond_id  = bond.bond_id.ToString(),
                    amount   = amount,
                    currency = (string)bond.currency,
                });
            }

            await _repo.MarkCouponPaidAsync((Guid)bond.bond_id, DateTime.UtcNow);
            Log.Information("Coupon processed for bond {BondId}: {Count} holders", bond.bond_id, holders.Count());
        }
    }

    private static int GetPaymentsPerYear(string frequency) => frequency switch
    {
        "Annual"     => 1,
        "SemiAnnual" => 2,
        "Quarterly"  => 4,
        _            => 1,
    };
}
