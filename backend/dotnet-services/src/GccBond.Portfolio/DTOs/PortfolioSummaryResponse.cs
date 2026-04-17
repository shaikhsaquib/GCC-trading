namespace GccBond.Portfolio.DTOs;

public record PortfolioSummaryResponse
{
    public decimal                         TotalValue          { get; init; }
    public decimal                         TotalCost           { get; init; }
    public decimal                         TotalUnrealizedPnl  { get; init; }
    public decimal                         TotalCouponReceived { get; init; }
    public decimal                         PnlPercentage       { get; init; }
    public IEnumerable<HoldingDetailResponse> Holdings         { get; init; } = [];
}

public record HoldingDetailResponse
{
    public Guid     BondId              { get; init; }
    public string   BondName            { get; init; } = "";
    public string   Isin                { get; init; } = "";
    public decimal  Quantity            { get; init; }
    public decimal  AvgBuyPrice         { get; init; }
    public decimal  CurrentPrice        { get; init; }
    public decimal  CurrentValue        { get; init; }
    public decimal  UnrealizedPnl       { get; init; }
    public decimal  UnrealizedPnlPct    { get; init; }
    public decimal  TotalCouponReceived { get; init; }
    public DateTime MaturityDate        { get; init; }
    public string   CouponFrequency     { get; init; } = "";
    public decimal  CouponRate          { get; init; }
    public decimal  Allocation          { get; init; }
}
