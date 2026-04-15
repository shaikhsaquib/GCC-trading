using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;

namespace GccBond.Marketplace.Services;

public record BondSearchRequest
{
    public string?     Search          { get; init; }
    public string?     IssuerType      { get; init; }
    public bool?       ShariaCompliant { get; init; }
    public decimal?    MinYtm          { get; init; }
    public decimal?    MaxYtm          { get; init; }
    public string?     Currency        { get; init; }
    public string      SortBy          { get; init; } = "created_at";
    public string      SortDir         { get; init; } = "DESC";
    public int         Limit           { get; init; } = 20;
    public int         Offset          { get; init; } = 0;
}

public record BondDetailResponse
{
    public BondListing Bond        { get; init; } = null!;
    public BondMetrics Metrics     { get; init; } = null!;
    public IEnumerable<dynamic> PriceHistory { get; init; } = [];
}

public class MarketplaceService
{
    private readonly DatabaseHelper _db;

    public MarketplaceService(DatabaseHelper db) => _db = db;

    // ── List Bonds ─────────────────────────────────────────────────────────────

    public async Task<(IEnumerable<BondListing> Items, int Total)> SearchBondsAsync(BondSearchRequest req)
    {
        var conditions = new List<string> { "status = 'Active'" };
        var param      = new Dapper.DynamicParameters();

        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            conditions.Add("(name ILIKE @Search OR isin ILIKE @Search OR issuer_name ILIKE @Search)");
            param.Add("Search", $"%{req.Search}%");
        }
        if (!string.IsNullOrWhiteSpace(req.IssuerType))
        {
            conditions.Add("issuer_type = @IssuerType");
            param.Add("IssuerType", req.IssuerType);
        }
        if (req.ShariaCompliant.HasValue)
        {
            conditions.Add("is_sharia_compliant = @Sharia");
            param.Add("Sharia", req.ShariaCompliant.Value);
        }
        if (!string.IsNullOrWhiteSpace(req.Currency))
        {
            conditions.Add("currency = @Currency");
            param.Add("Currency", req.Currency);
        }

        var where   = string.Join(" AND ", conditions);
        var sortCol = req.SortBy switch
        {
            "name"          => "name",
            "current_price" => "current_price",
            "coupon_rate"   => "coupon_rate",
            "maturity_date" => "maturity_date",
            _               => "created_at",
        };
        var sortDir = req.SortDir.ToUpper() == "ASC" ? "ASC" : "DESC";

        param.Add("Limit",  req.Limit);
        param.Add("Offset", req.Offset);

        var bonds = await _db.QueryAsync<BondListing>(
            $"SELECT * FROM bonds.listings WHERE {where} ORDER BY {sortCol} {sortDir} LIMIT @Limit OFFSET @Offset",
            param);

        var total = await _db.ExecuteScalarAsync<int>(
            $"SELECT COUNT(*) FROM bonds.listings WHERE {where}", param);

        return (bonds, total ?? 0);
    }

    // ── Bond Detail with Metrics ───────────────────────────────────────────────

    public async Task<BondDetailResponse?> GetBondDetailAsync(Guid bondId)
    {
        var bond = await _db.QueryFirstOrDefaultAsync<BondListing>(
            "SELECT * FROM bonds.listings WHERE id = @Id",
            new { Id = bondId });

        if (bond is null) return null;

        // Price history from TimescaleDB (last 90 days)
        var priceHistory = await _db.QueryAsync<dynamic>(@"
            SELECT
                time_bucket('1 day', recorded_at) AS date,
                first(price, recorded_at)          AS open,
                MAX(price)                         AS high,
                MIN(price)                         AS low,
                last(price, recorded_at)           AS close
            FROM bonds.price_history
            WHERE bond_id = @BondId
              AND recorded_at >= NOW() - INTERVAL '90 days'
            GROUP BY 1
            ORDER BY 1 DESC",
            new { BondId = bondId });

        var metrics = CalculateMetrics(bond);
        return new BondDetailResponse { Bond = bond, Metrics = metrics, PriceHistory = priceHistory };
    }

    // ── Admin: Create / Update Bond Listing ───────────────────────────────────

    public async Task<BondListing> CreateBondAsync(BondListing bond)
    {
        var id  = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await _db.ExecuteAsync(@"
            INSERT INTO bonds.listings
                (id, isin, name, issuer_name, issuer_type, currency, face_value,
                 coupon_rate, coupon_frequency, maturity_date, credit_rating,
                 is_sharia_compliant, min_investment, current_price, status, created_at, updated_at)
            VALUES
                (@Id, @Isin, @Name, @IssuerName, @IssuerType, @Currency, @FaceValue,
                 @CouponRate, @CouponFrequency, @MaturityDate, @CreditRating,
                 @IsShariaCompliant, @MinInvestment, @CurrentPrice, 'Active', @Now, @Now)",
            new
            {
                Id = id, bond.Isin, bond.Name, bond.IssuerName,
                IssuerType = bond.IssuerType.ToString(),
                bond.Currency, bond.FaceValue, bond.CouponRate,
                CouponFrequency = bond.CouponFrequency.ToString(),
                bond.MaturityDate, bond.CreditRating,
                bond.IsShariaCompliant, bond.MinInvestment, bond.CurrentPrice,
                Now = now,
            });

        return bond with { Id = id, CreatedAt = now, UpdatedAt = now, Status = BondStatus.Active };
    }

    public async Task UpdateBondPriceAsync(Guid bondId, decimal newPrice)
    {
        await _db.ExecuteAsync(@"
            UPDATE bonds.listings SET current_price = @Price, updated_at = NOW() WHERE id = @Id",
            new { Id = bondId, Price = newPrice });

        // Insert into price history (TimescaleDB)
        await _db.ExecuteAsync(@"
            INSERT INTO bonds.price_history (bond_id, price, recorded_at) VALUES (@BondId, @Price, NOW())",
            new { BondId = bondId, Price = newPrice });
    }

    // ── Bond Math ──────────────────────────────────────────────────────────────

    private static BondMetrics CalculateMetrics(BondListing bond)
    {
        var settlement    = DateTime.UtcNow.Date;
        var maturityDate  = bond.MaturityDate.ToDateTime(TimeOnly.MinValue);
        var daysRemaining = (maturityDate - settlement).TotalDays;
        int m             = BondMathService.PaymentsPerYear(bond.CouponFrequency.ToString());
        int periods       = (int)Math.Round(daysRemaining / (365.0 / m));

        var ytm      = BondMathService.CalculateYtm(bond.CurrentPrice, bond.FaceValue, bond.CouponRate, m, periods);
        var currYield= BondMathService.CurrentYield(bond.FaceValue, bond.CouponRate, bond.CurrentPrice);
        var duration = BondMathService.ModifiedDuration(ytm, m, periods, bond.CurrentPrice, bond.FaceValue, bond.CouponRate);

        // Last coupon date approximation
        var lastCoupon = settlement.AddDays(-(365.0 / m));
        var accrued    = BondMathService.AccruedInterest(bond.FaceValue, bond.CouponRate, m, lastCoupon, settlement);
        var dirty      = BondMathService.DirtyPrice(bond.CurrentPrice, accrued);

        return new BondMetrics
        {
            Ytm             = ytm,
            CurrentYield    = currYield,
            ModifiedDuration= duration,
            AccruedInterest = accrued,
            DirtyPrice      = dirty,
        };
    }
}
