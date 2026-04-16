using GccBond.Shared.Models;

namespace GccBond.Settlement.Interfaces;

public interface ISettlementService
{
    Task RunDailyBatchAsync();
    Task ProcessSettlementAsync(Settlement settlement);
    Task<IEnumerable<Settlement>> GetSettlementsAsync(string? status, int limit, int offset);
    Task<Settlement?> GetByTradeIdAsync(Guid tradeId);
}
