using GccBond.Shared.Infrastructure;
using Serilog;

namespace GccBond.AML.Services;

public enum AlertSeverity { Low, Medium, High, Critical }
public enum AlertStatus   { Open, UnderReview, Escalated, Cleared, SarFiled }

public record AmlAlert
{
    public Guid          Id          { get; init; }
    public Guid          UserId      { get; init; }
    public string        RuleCode    { get; init; } = "";
    public string        Description { get; init; } = "";
    public AlertSeverity Severity    { get; init; }
    public AlertStatus   Status      { get; set;  }
    public decimal       Amount      { get; init; }
    public string        Currency    { get; init; } = "AED";
    public string?       SarRef      { get; set;  }
    public DateTime      CreatedAt   { get; init; }
    public DateTime      UpdatedAt   { get; set;  }
}

/// <summary>
/// AML rule engine (FSD §15 — Anti-Money Laundering).
/// Screens transactions and generates alerts / SAR filings.
/// </summary>
public class AmlService
{
    private readonly DatabaseHelper _db;
    private readonly IEventBus      _eventBus;

    // Thresholds per FSD §15.2
    private const decimal LargeTransactionThresholdAed = 55_000m; // FATF threshold
    private const decimal StructuringWindowAed         = 50_000m; // pattern detection
    private const int     StructuringWindowDays        = 7;

    public AmlService(DatabaseHelper db, IEventBus eventBus)
    {
        _db       = db;
        _eventBus = eventBus;
    }

    // ── Screen a Transaction ──────────────────────────────────────────────────

    public async Task ScreenTransactionAsync(Guid userId, decimal amount, string currency, string transactionId, string type)
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

    // ── Rule: Large Cash Transaction ──────────────────────────────────────────

    private async Task CheckLargeTransactionAsync(Guid userId, decimal amount, string currency, string transactionId)
    {
        // Convert to AED if necessary (simplified — assume 1:1 for demo; real impl would use FX rates)
        if (amount < LargeTransactionThresholdAed) return;

        await RaiseAlertAsync(new AmlAlert
        {
            Id          = Guid.NewGuid(),
            UserId      = userId,
            RuleCode    = "AML-001",
            Description = $"Large transaction: {amount:F2} {currency} (ref: {transactionId})",
            Severity    = amount >= LargeTransactionThresholdAed * 2 ? AlertSeverity.Critical : AlertSeverity.High,
            Amount      = amount,
            Currency    = currency,
            Status      = AlertStatus.Open,
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow,
        });
    }

    // ── Rule: Structuring (Smurfing) ──────────────────────────────────────────

    private async Task CheckStructuringAsync(Guid userId, decimal amount, string currency)
    {
        // Check if total deposits in last N days suggest structuring (just below threshold)
        if (amount > StructuringWindowAed) return; // only flag amounts just below threshold

        var recentTotal = await _db.ExecuteScalarAsync<decimal>(@"
            SELECT COALESCE(SUM(amount), 0)
            FROM wallet.transactions
            WHERE wallet_id = (SELECT id FROM wallet.wallets WHERE user_id = @UserId)
              AND type    = 'CREDIT'
              AND status  = 'COMPLETED'
              AND created_at >= NOW() - INTERVAL '@Days days'",
            new { UserId = userId, Days = StructuringWindowDays });

        if (recentTotal + amount >= LargeTransactionThresholdAed)
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

    // ── Rule: Sanctions Screening ─────────────────────────────────────────────

    private async Task CheckSanctionsAsync(Guid userId)
    {
        // Check user's name against sanctions list in DB (loaded from OFAC/UN/EU feeds)
        var hit = await _db.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT sl.name, sl.list_source
            FROM aml.sanctions_list sl
            JOIN auth.users u ON u.name_normalized ILIKE sl.name_normalized
            WHERE u.id = @UserId
            LIMIT 1",
            new { UserId = userId });

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

    // ── Rule: Unusual Trading Pattern ─────────────────────────────────────────

    private async Task CheckTradingPatternAsync(Guid userId, decimal tradeValue)
    {
        // Check if daily trading volume exceeds 10x user's 30-day average
        var avgDaily = await _db.ExecuteScalarAsync<decimal>(@"
            SELECT COALESCE(AVG(daily_total), 0)
            FROM (
                SELECT DATE(executed_at) AS day, SUM(quantity * price) AS daily_total
                FROM trading.trades
                WHERE (buyer_id = @UserId OR seller_id = @UserId)
                  AND executed_at >= NOW() - INTERVAL '30 days'
                GROUP BY 1
            ) t",
            new { UserId = userId });

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

    // ── Alert Management ───────────────────────────────────────────────────────

    private async Task RaiseAlertAsync(AmlAlert alert)
    {
        await _db.ExecuteAsync(@"
            INSERT INTO aml.alerts
                (id, user_id, rule_code, description, severity, status, amount, currency, created_at, updated_at)
            VALUES
                (@Id, @UserId, @RuleCode, @Description, @Severity, @Status, @Amount, @Currency, @CreatedAt, @UpdatedAt)",
            new
            {
                alert.Id, alert.UserId, alert.RuleCode, alert.Description,
                Severity  = alert.Severity.ToString(),
                Status    = alert.Status.ToString(),
                alert.Amount, alert.Currency, alert.CreatedAt, alert.UpdatedAt,
            });

        await _eventBus.PublishAsync(Events.AmlAlert, new
        {
            alert_id    = alert.Id,
            user_id     = alert.UserId,
            rule_code   = alert.RuleCode,
            severity    = alert.Severity.ToString(),
            description = alert.Description,
        });

        Log.Warning("AML alert raised: {RuleCode} for user {UserId} severity {Severity}",
            alert.RuleCode, alert.UserId, alert.Severity);
    }

    public async Task<IEnumerable<AmlAlert>> GetAlertsAsync(string? status = null, int limit = 50, int offset = 0)
    {
        var sql = status is null
            ? "SELECT * FROM aml.alerts ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset"
            : "SELECT * FROM aml.alerts WHERE status = @Status ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset";
        return await _db.QueryAsync<AmlAlert>(sql, new { Status = status, Limit = limit, Offset = offset });
    }

    public async Task UpdateAlertStatusAsync(Guid alertId, AlertStatus newStatus, string? sarRef = null)
    {
        await _db.ExecuteAsync(@"
            UPDATE aml.alerts
            SET status = @Status, sar_ref = @SarRef, updated_at = NOW()
            WHERE id = @Id",
            new { Id = alertId, Status = newStatus.ToString(), SarRef = sarRef });
    }

    // ── Sanctions List Refresh ─────────────────────────────────────────────────

    public async Task RefreshSanctionsListAsync(IEnumerable<(string Name, string Source)> entries)
    {
        await _db.ExecuteAsync("TRUNCATE aml.sanctions_list");

        foreach (var (name, source) in entries)
        {
            await _db.ExecuteAsync(@"
                INSERT INTO aml.sanctions_list (id, name, name_normalized, list_source, added_at)
                VALUES (gen_random_uuid(), @Name, LOWER(REGEXP_REPLACE(@Name, '\s+', ' ', 'g')), @Source, NOW())",
                new { Name = name, Source = source });
        }

        Log.Information("Sanctions list refreshed: {Count} entries", entries.Count());
    }
}
