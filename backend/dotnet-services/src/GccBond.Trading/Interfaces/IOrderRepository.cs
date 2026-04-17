using GccBond.Shared.Models;

namespace GccBond.Trading.Interfaces;

public interface IOrderRepository
{
    Task<Order?> GetByIdAsync(Guid id);
    Task<Order?> GetByIdAndUserAsync(Guid id, Guid userId);
    Task<Order?> GetByIdempotencyKeyAsync(string key);
    Task<IEnumerable<Order>> GetUserOrdersAsync(Guid userId, string? status, int limit, int offset);
    Task<Order> CreateAsync(Order order);
    Task UpdateStatusAsync(Guid id, OrderStatus status, string? cancelReason = null);
    Task UpdateFillAsync(Guid id, decimal fillQty, decimal fillPrice, DateTime now);
    Task<Order?> FindBestCounterpartyAsync(Guid bondId, OrderSide oppositeSide, decimal? price, OrderType type);
    Task<(IEnumerable<dynamic> Bids, IEnumerable<dynamic> Asks)> GetOrderBookAsync(Guid bondId, int depth);
    Task CreateTradeAsync(Trade trade);
    Task CreateSettlementAsync(Guid tradeId, DateTime tradeDate, DateTime settlementDate);
}
