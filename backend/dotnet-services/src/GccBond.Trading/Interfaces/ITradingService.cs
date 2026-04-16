using GccBond.Shared.Models;
using GccBond.Trading.DTOs;

namespace GccBond.Trading.Interfaces;

public interface ITradingService
{
    Task<Order> PlaceOrderAsync(PlaceOrderRequest request);
    Task<Order> CancelOrderAsync(Guid orderId, Guid userId);
    Task<Order?> GetOrderAsync(Guid orderId, Guid userId);
    Task<IEnumerable<Order>> GetUserOrdersAsync(Guid userId, string? status, int limit, int offset);
    Task<OrderBookResponse> GetOrderBookAsync(Guid bondId, int depth);
}
