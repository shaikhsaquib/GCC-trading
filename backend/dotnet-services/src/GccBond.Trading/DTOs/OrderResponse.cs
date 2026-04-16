using GccBond.Shared.Models;

namespace GccBond.Trading.DTOs;

public record OrderResponse
{
    public Guid        Id             { get; init; }
    public Guid        UserId         { get; init; }
    public Guid        BondId         { get; init; }
    public string      Side           { get; init; } = "";
    public string      OrderType      { get; init; } = "";
    public decimal     Quantity       { get; init; }
    public decimal     FilledQuantity { get; init; }
    public decimal?    Price          { get; init; }
    public decimal?    AvgFillPrice   { get; init; }
    public string      Status         { get; init; } = "";
    public DateTime?   ExpiresAt      { get; init; }
    public string?     CancelReason   { get; init; }
    public DateTime    CreatedAt      { get; init; }
    public DateTime    UpdatedAt      { get; init; }

    public static OrderResponse FromModel(Order o) => new()
    {
        Id             = o.Id,
        UserId         = o.UserId,
        BondId         = o.BondId,
        Side           = o.Side.ToString(),
        OrderType      = o.OrderType.ToString(),
        Quantity       = o.Quantity,
        FilledQuantity = o.FilledQuantity,
        Price          = o.Price,
        AvgFillPrice   = o.AvgFillPrice,
        Status         = o.Status.ToString(),
        ExpiresAt      = o.ExpiresAt,
        CancelReason   = o.CancelReason,
        CreatedAt      = o.CreatedAt,
        UpdatedAt      = o.UpdatedAt,
    };
}

public record OrderBookResponse
{
    public IEnumerable<OrderBookLevel> Bids { get; init; } = [];
    public IEnumerable<OrderBookLevel> Asks { get; init; } = [];
}

public record OrderBookLevel
{
    public decimal Price    { get; init; }
    public decimal Quantity { get; init; }
    public int     Orders   { get; init; }
}
