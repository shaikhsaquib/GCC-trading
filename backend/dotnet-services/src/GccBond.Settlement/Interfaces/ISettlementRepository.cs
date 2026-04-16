using GccBond.Shared.Models;
using SettlementModel = GccBond.Shared.Models.Settlement;

namespace GccBond.Settlement.Interfaces;

public interface ISettlementRepository
{
    Task<IEnumerable<SettlementModel>> GetPendingAsync(int maxRetries);
    Task<SettlementModel?> GetByTradeIdAsync(Guid tradeId);
    Task<IEnumerable<SettlementModel>> GetAllAsync(string? status, int limit, int offset);
    Task<Trade?> GetTradeAsync(Guid tradeId);
    Task MarkProcessingAsync(Guid settlementId);
    Task MarkCompletedAsync(Guid settlementId, Guid buyOrderId, Guid sellOrderId, Trade trade);
    Task MarkFailedAsync(Guid settlementId, int retryCount, string reason, bool isFinal);
}
