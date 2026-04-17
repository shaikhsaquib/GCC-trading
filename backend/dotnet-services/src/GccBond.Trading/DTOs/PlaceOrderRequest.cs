using GccBond.Shared.Models;

namespace GccBond.Trading.DTOs;

public record PlaceOrderRequest
{
    public Guid      UserId         { get; init; }
    public Guid      BondId         { get; init; }
    public OrderSide Side           { get; init; }
    public OrderType OrderType      { get; init; }
    public decimal   Quantity       { get; init; }
    public decimal?  Price          { get; init; }
    public DateTime? ExpiresAt      { get; init; }
    public string    IdempotencyKey { get; init; } = "";
}
