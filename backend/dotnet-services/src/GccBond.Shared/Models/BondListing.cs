namespace GccBond.Shared.Models;

/// <summary>Bond listing domain model — maps to bonds.listings table (FSD §6.5).</summary>
public record BondListing
{
    public Guid            Id                { get; init; }
    public string          Isin              { get; init; } = "";
    public string          Name              { get; init; } = "";
    public string          IssuerName        { get; init; } = "";
    public IssuerType      IssuerType        { get; init; }
    public string          Currency          { get; init; } = "AED";
    public decimal         FaceValue         { get; init; }
    public decimal         CouponRate        { get; init; }
    public CouponFrequency CouponFrequency   { get; init; }
    public DateOnly        MaturityDate      { get; init; }
    public string?         CreditRating      { get; init; }
    public bool            IsShariaCompliant { get; init; }
    public decimal         MinInvestment     { get; init; }
    public decimal         CurrentPrice      { get; init; }
    public BondStatus      Status            { get; init; }
    public DateTime        CreatedAt         { get; init; }
    public DateTime        UpdatedAt         { get; init; }
}
