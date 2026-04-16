using GccBond.Marketplace.DTOs;
using GccBond.Marketplace.Interfaces;
using GccBond.Shared.Exceptions;
using GccBond.Shared.Models;

namespace GccBond.Marketplace.Services;

/// <summary>
/// Business logic for bond marketplace (FSD §6.5).
/// No SQL — all data access goes through IBondRepository.
/// </summary>
public class MarketplaceService : IMarketplaceService
{
    private readonly IBondRepository _bonds;

    public MarketplaceService(IBondRepository bonds) => _bonds = bonds;

    public async Task<PagedBondResponse> SearchBondsAsync(BondSearchRequest req)
    {
        var (items, total) = await _bonds.SearchAsync(
            req.Search, req.IssuerType, req.ShariaCompliant,
            req.Currency, req.SortBy, req.SortDir, req.Limit, req.Offset);

        return new PagedBondResponse
        {
            Items  = items.Select(BondResponse.FromModel),
            Total  = total,
            Limit  = req.Limit,
            Offset = req.Offset,
        };
    }

    public async Task<BondDetailResponse?> GetBondDetailAsync(Guid bondId)
    {
        var bond = await _bonds.GetByIdAsync(bondId);
        if (bond is null) return null;

        var priceHistory = await _bonds.GetPriceHistoryAsync(bondId, 90);
        var metrics      = CalculateMetrics(bond);

        return new BondDetailResponse
        {
            Bond         = BondResponse.FromModel(bond),
            Metrics      = metrics,
            PriceHistory = priceHistory,
        };
    }

    public async Task<BondResponse> CreateBondAsync(CreateBondRequest req)
    {
        var bond = new BondListing
        {
            Id                = Guid.NewGuid(),
            Isin              = req.Isin,
            Name              = req.Name,
            IssuerName        = req.IssuerName,
            IssuerType        = Enum.Parse<IssuerType>(req.IssuerType),
            Currency          = req.Currency,
            FaceValue         = req.FaceValue,
            CouponRate        = req.CouponRate,
            CouponFrequency   = Enum.Parse<CouponFrequency>(req.CouponFrequency),
            MaturityDate      = DateOnly.Parse(req.MaturityDate),
            CreditRating      = req.CreditRating,
            IsShariaCompliant = req.IsShariaCompliant,
            MinInvestment     = req.MinInvestment,
            CurrentPrice      = req.CurrentPrice,
            Status            = BondStatus.Active,
            CreatedAt         = DateTime.UtcNow,
            UpdatedAt         = DateTime.UtcNow,
        };

        var id = await _bonds.CreateAsync(bond);
        return BondResponse.FromModel(bond with { Id = id });
    }

    public async Task UpdateBondPriceAsync(Guid bondId, decimal newPrice)
    {
        var bond = await _bonds.GetByIdAsync(bondId)
            ?? throw new NotFoundException("Bond");

        if (newPrice <= 0)
            throw new ValidationException("Price must be greater than 0");

        await _bonds.UpdatePriceAsync(bondId, newPrice);
    }

    private static BondMetricsResponse CalculateMetrics(BondListing bond)
    {
        var settlement    = DateTime.UtcNow.Date;
        var maturityDate  = bond.MaturityDate.ToDateTime(TimeOnly.MinValue);
        var daysRemaining = (maturityDate - settlement).TotalDays;
        var m             = BondMathService.PaymentsPerYear(bond.CouponFrequency.ToString());
        var periods       = (int)Math.Round(daysRemaining / (365.0 / m));

        var ytm       = BondMathService.CalculateYtm(bond.CurrentPrice, bond.FaceValue, bond.CouponRate, m, periods);
        var currYield = BondMathService.CurrentYield(bond.FaceValue, bond.CouponRate, bond.CurrentPrice);
        var duration  = BondMathService.ModifiedDuration(ytm, m, periods, bond.CurrentPrice, bond.FaceValue, bond.CouponRate);
        var lastCoupon= settlement.AddDays(-(365.0 / m));
        var accrued   = BondMathService.AccruedInterest(bond.FaceValue, bond.CouponRate, m, lastCoupon, settlement);
        var dirty     = BondMathService.DirtyPrice(bond.CurrentPrice, accrued);

        return new BondMetricsResponse
        {
            Ytm              = ytm,
            CurrentYield     = currYield,
            ModifiedDuration = duration,
            AccruedInterest  = accrued,
            DirtyPrice       = dirty,
        };
    }
}
