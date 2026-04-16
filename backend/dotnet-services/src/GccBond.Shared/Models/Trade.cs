namespace GccBond.Shared.Models;

/// <summary>Trade domain model — maps to trading.trades table.</summary>
public record Trade
{
    public Guid     Id             { get; init; }
    public Guid     BuyOrderId     { get; init; }
    public Guid     SellOrderId    { get; init; }
    public Guid     BuyerId        { get; init; }
    public Guid     SellerId       { get; init; }
    public Guid     BondId         { get; init; }
    public decimal  Quantity       { get; init; }
    public decimal  Price          { get; init; }
    public decimal  BuyerFee       { get; init; }
    public decimal  SellerFee      { get; init; }
    public decimal  SettlementFee  { get; init; }
    public DateTime ExecutedAt     { get; init; }
}
