using GccBond.Shared.Models;

namespace GccBond.Settlement.Interfaces;

public interface ISettlementRepository
{
    Task<IEnumerable<Settlement>> GetPendingAsync(int maxRetries);
    Task<Settlement?> GetByTradeIdAsync(Guid tradeId);
    Task<IEnumerable<Settlement>> GetAllAsync(string? status, int limit, int offset);
    Task<Trade?> GetTradeAsync(Guid tradeId);
    Task MarkProcessingAsync(Guid settlementId);
    Task MarkCompletedAsync(Guid settlementId, Guid buyOrderId, Guid sellOrderId, Trade trade);
    Task MarkFailedAsync(Guid settlementId, int retryCount, string reason, bool isFinal);
}
