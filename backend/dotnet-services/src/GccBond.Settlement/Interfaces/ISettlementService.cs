using GccBond.Shared.Models;
using SettlementModel = GccBond.Shared.Models.Settlement;

namespace GccBond.Settlement.Interfaces;

public interface ISettlementService
{
    Task RunDailyBatchAsync();
    Task ProcessSettlementAsync(SettlementModel settlement);
    Task<IEnumerable<SettlementModel>> GetSettlementsAsync(string? status, int limit, int offset);
    Task<SettlementModel?> GetByTradeIdAsync(Guid tradeId);
}
