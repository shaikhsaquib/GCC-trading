namespace GccBond.Shared.Models;

/// <summary>Portfolio holding domain model — maps to portfolio.holdings table.</summary>
public record PortfolioHolding
{
    public Guid     Id                   { get; init; }
    public Guid     UserId               { get; init; }
    public Guid     BondId               { get; init; }
    public decimal  Quantity             { get; init; }
    public decimal  AvgBuyPrice          { get; init; }
    public decimal  CurrentValue         { get; init; }
    public decimal  UnrealizedPnl        { get; init; }
    public decimal  TotalCouponReceived  { get; init; }
    public DateTime UpdatedAt            { get; init; }
}
