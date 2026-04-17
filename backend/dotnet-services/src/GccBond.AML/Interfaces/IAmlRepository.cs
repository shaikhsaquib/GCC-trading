using GccBond.Shared.Models;

namespace GccBond.AML.Interfaces;

public interface IAmlRepository
{
    Task<IEnumerable<AmlAlert>> GetAlertsAsync(string? status, int limit, int offset);
    Task CreateAlertAsync(AmlAlert alert);
    Task UpdateAlertAsync(Guid alertId, AlertStatus status, string? sarRef);
    Task<decimal> GetRecentDepositTotalAsync(Guid userId, int days);
    Task<dynamic?> GetSanctionsHitAsync(Guid userId);
    Task<decimal> GetDailyTradingAverageAsync(Guid userId);
    Task RefreshSanctionsListAsync(IEnumerable<(string Name, string Source)> entries);
}
