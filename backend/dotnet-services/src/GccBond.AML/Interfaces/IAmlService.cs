using GccBond.Shared.Models;

namespace GccBond.AML.Interfaces;

public interface IAmlService
{
    Task ScreenTransactionAsync(Guid userId, decimal amount, string currency, string transactionId, string type);
    Task<IEnumerable<AmlAlert>> GetAlertsAsync(string? status, int limit, int offset);
    Task UpdateAlertStatusAsync(Guid alertId, AlertStatus newStatus, string? sarRef);
    Task RefreshSanctionsListAsync(IEnumerable<(string Name, string Source)> entries);
}
