using GccBond.Shared.Models;

namespace GccBond.Marketplace.DTOs;

public record BondResponse
{
    public Guid    Id                { get; init; }
    public string  Isin              { get; init; } = "";
    public string  Name              { get; init; } = "";
    public string  IssuerName        { get; init; } = "";
    public string  IssuerType        { get; init; } = "";
    public string  Currency          { get; init; } = "";
    public decimal FaceValue         { get; init; }
    public decimal CouponRate        { get; init; }
    public string  CouponFrequency   { get; init; } = "";
    public string  MaturityDate      { get; init; } = "";
    public string? CreditRating      { get; init; }
    public bool    IsShariaCompliant { get; init; }
    public decimal MinInvestment     { get; init; }
    public decimal CurrentPrice      { get; init; }
    public string  Status            { get; init; } = "";
    public DateTime CreatedAt        { get; init; }

    public static BondResponse FromModel(BondListing b) => new()
    {
        Id                = b.Id,
        Isin              = b.Isin,
        Name              = b.Name,
        IssuerName        = b.IssuerName,
        IssuerType        = b.IssuerType.ToString(),
        Currency          = b.Currency,
        FaceValue         = b.FaceValue,
        CouponRate        = b.CouponRate,
        CouponFrequency   = b.CouponFrequency.ToString(),
        MaturityDate      = b.MaturityDate.ToString("yyyy-MM-dd"),
        CreditRating      = b.CreditRating,
        IsShariaCompliant = b.IsShariaCompliant,
        MinInvestment     = b.MinInvestment,
        CurrentPrice      = b.CurrentPrice,
        Status            = b.Status.ToString(),
        CreatedAt         = b.CreatedAt,
    };
}

public record BondDetailResponse
{
    public BondResponse          Bond         { get; init; } = null!;
    public BondMetricsResponse   Metrics      { get; init; } = null!;
    public IEnumerable<dynamic>  PriceHistory { get; init; } = [];
}

public record BondMetricsResponse
{
    public decimal Ytm              { get; init; }
    public decimal CurrentYield     { get; init; }
    public decimal ModifiedDuration { get; init; }
    public decimal AccruedInterest  { get; init; }
    public decimal DirtyPrice       { get; init; }
}

public record PagedBondResponse
{
    public IEnumerable<BondResponse> Items  { get; init; } = [];
    public int                       Total  { get; init; }
    public int                       Limit  { get; init; }
    public int                       Offset { get; init; }
}

public record CreateBondRequest
{
    public string  Isin              { get; init; } = "";
    public string  Name              { get; init; } = "";
    public string  IssuerName        { get; init; } = "";
    public string  IssuerType        { get; init; } = "";
    public string  Currency          { get; init; } = "AED";
    public decimal FaceValue         { get; init; }
    public decimal CouponRate        { get; init; }
    public string  CouponFrequency   { get; init; } = "Annual";
    public string  MaturityDate      { get; init; } = "";
    public string? CreditRating      { get; init; }
    public bool    IsShariaCompliant { get; init; }
    public decimal MinInvestment     { get; init; }
    public decimal CurrentPrice      { get; init; }
}
