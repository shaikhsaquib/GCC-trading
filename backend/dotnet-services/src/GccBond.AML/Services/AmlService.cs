using GccBond.AML.Interfaces;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using Serilog;

namespace GccBond.AML.Services;

/// <summary>
/// AML rule engine (FSD §15). No SQL — all data access goes through IAmlRepository.
/// </summary>
public class AmlService : IAmlService
{
    private readonly IAmlRepository _repo;
    private readonly IEventBus      _eventBus;

    private const decimal LargeTransactionThreshold = 55_000m;
    private const decimal StructuringWindow         = 50_000m;
    private const int     StructuringWindowDays     = 7;

    public AmlService(IAmlRepository repo, IEventBus eventBus)
    {
        _repo     = repo;
        _eventBus = eventBus;
    }

    public async Task ScreenTransactionAsync(
        Guid userId, decimal amount, string currency, string transactionId, string type)
    {
        var tasks = new List<Task>
        {
            CheckLargeTransactionAsync(userId, amount, currency, transactionId),
            CheckStructuringAsync(userId, amount, currency),
            CheckSanctionsAsync(userId),
        };

        if (type == "TRADE")
            tasks.Add(CheckTradingPatternAsync(userId, amount));

        await Task.WhenAll(tasks);
    }

    private async Task CheckLargeTransactionAsync(
        Guid userId, decimal amount, string currency, string transactionId)
    {
        if (amount < LargeTransactionThreshold) return;

        await RaiseAlertAsync(new AmlAlert
        {
            Id          = Guid.NewGuid(),
            UserId      = userId,
            RuleCode    = "AML-001",
            Description = $"Large transaction: {amount:F2} {currency} (ref: {transactionId})",
            Severity    = amount >= LargeTransactionThreshold * 2 ? AlertSeverity.Critical : AlertSeverity.High,
            Amount      = amount,
            Currency    = currency,
            Status      = AlertStatus.Open,
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow,
        });
    }

    private async Task CheckStructuringAsync(Guid userId, decimal amount, string currency)
    {
        if (amount > StructuringWindow) return;

        var recentTotal = await _repo.GetRecentDepositTotalAsync(userId, StructuringWindowDays);

        if (recentTotal + amount >= LargeTransactionThreshold)
        {
            await RaiseAlertAsync(new AmlAlert
            {
                Id          = Guid.NewGuid(),
                UserId      = userId,
                RuleCode    = "AML-002",
                Description = $"Possible structuring: {recentTotal + amount:F2} {currency} over {StructuringWindowDays} days",
                Severity    = AlertSeverity.High,
                Amount      = recentTotal + amount,
                Currency    = currency,
                Status      = AlertStatus.Open,
                CreatedAt   = DateTime.UtcNow,
                UpdatedAt   = DateTime.UtcNow,
            });
        }
    }

    private async Task CheckSanctionsAsync(Guid userId)
    {
        var hit = await _repo.GetSanctionsHitAsync(userId);
        if (hit is null) return;

        await RaiseAlertAsync(new AmlAlert
        {
            Id          = Guid.NewGuid(),
            UserId      = userId,
            RuleCode    = "AML-003",
            Description = $"Sanctions hit: {hit.name} ({hit.list_source})",
            Severity    = AlertSeverity.Critical,
            Amount      = 0,
            Status      = AlertStatus.Open,
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow,
        });
    }

    private async Task CheckTradingPatternAsync(Guid userId, decimal tradeValue)
    {
        var avgDaily = await _repo.GetDailyTradingAverageAsync(userId);
        if (avgDaily > 0 && tradeValue > avgDaily * 10)
        {
            await RaiseAlertAsync(new AmlAlert
            {
                Id          = Guid.NewGuid(),
                UserId      = userId,
                RuleCode    = "AML-004",
                Description = $"Unusual trading: {tradeValue:F2} AED vs 30d avg {avgDaily:F2} AED",
                Severity    = AlertSeverity.Medium,
                Amount      = tradeValue,
                Status      = AlertStatus.Open,
                CreatedAt   = DateTime.UtcNow,
                UpdatedAt   = DateTime.UtcNow,
            });
        }
    }

    private async Task RaiseAlertAsync(AmlAlert alert)
    {
        await _repo.CreateAlertAsync(alert);
        await _eventBus.PublishAsync(Events.AmlAlert, new
        {
            alert_id    = alert.Id,
            user_id     = alert.UserId,
            rule_code   = alert.RuleCode,
            severity    = alert.Severity.ToString(),
            description = alert.Description,
        });
        Log.Warning("AML alert raised: {RuleCode} user={UserId} severity={Severity}",
            alert.RuleCode, alert.UserId, alert.Severity);
    }

    public Task<IEnumerable<AmlAlert>> GetAlertsAsync(string? status, int limit, int offset)
        => _repo.GetAlertsAsync(status, limit, offset);

    public Task UpdateAlertStatusAsync(Guid alertId, AlertStatus newStatus, string? sarRef)
        => _repo.UpdateAlertAsync(alertId, newStatus, sarRef);

    public Task RefreshSanctionsListAsync(IEnumerable<(string Name, string Source)> entries)
        => _repo.RefreshSanctionsListAsync(entries);
}
