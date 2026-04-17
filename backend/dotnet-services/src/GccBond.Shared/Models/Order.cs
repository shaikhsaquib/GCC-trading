namespace GccBond.Shared.Models;

/// <summary>Order domain model — maps to trading.orders table (FSD §6.4).</summary>
public record Order
{
    public Guid        Id             { get; init; }
    public Guid        UserId         { get; init; }
    public Guid        BondId         { get; init; }
    public OrderSide   Side           { get; init; }
    public OrderType   OrderType      { get; init; }
    public decimal     Quantity       { get; init; }
    public decimal     FilledQuantity { get; set; }
    public decimal?    Price          { get; init; }
    public decimal?    AvgFillPrice   { get; set; }
    public OrderStatus Status         { get; set; }
    public DateTime?   ExpiresAt      { get; init; }
    public string?     CancelReason   { get; set; }
    public string      IdempotencyKey { get; init; } = "";
    public DateTime    CreatedAt      { get; init; }
    public DateTime    UpdatedAt      { get; set; }
}
