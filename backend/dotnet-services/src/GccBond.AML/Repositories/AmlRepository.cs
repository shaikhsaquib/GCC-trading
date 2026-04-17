using GccBond.AML.Interfaces;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;

namespace GccBond.AML.Repositories;

public class AmlRepository : IAmlRepository
{
    private readonly DatabaseHelper _db;

    public AmlRepository(DatabaseHelper db) => _db = db;

    public Task<IEnumerable<AmlAlert>> GetAlertsAsync(string? status, int limit, int offset)
    {
        var sql = status is null
            ? "SELECT * FROM aml.alerts ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset"
            : "SELECT * FROM aml.alerts WHERE status = @Status ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset";
        return _db.QueryAsync<AmlAlert>(sql, new { Status = status, Limit = limit, Offset = offset });
    }

    public Task CreateAlertAsync(AmlAlert alert)
        => _db.ExecuteAsync(@"
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

    public Task UpdateAlertAsync(Guid alertId, AlertStatus status, string? sarRef)
        => _db.ExecuteAsync(
            "UPDATE aml.alerts SET status = @Status, sar_ref = @SarRef, updated_at = NOW() WHERE id = @Id",
            new { Id = alertId, Status = status.ToString(), SarRef = sarRef });

    public Task<decimal> GetRecentDepositTotalAsync(Guid userId, int days)
        => _db.ExecuteScalarAsync<decimal>(@"
            SELECT COALESCE(SUM(amount), 0)
            FROM wallet.transactions
            WHERE wallet_id = (SELECT id FROM wallet.wallets WHERE user_id = @UserId)
              AND type = 'CREDIT' AND status = 'COMPLETED'
              AND created_at >= NOW() - INTERVAL '1 day' * @Days",
            new { UserId = userId, Days = days })!;

    public Task<dynamic?> GetSanctionsHitAsync(Guid userId)
        => _db.QueryFirstOrDefaultAsync<dynamic>(@"
            SELECT sl.name, sl.list_source
            FROM aml.sanctions_list sl
            JOIN auth.users u ON u.name_normalized ILIKE sl.name_normalized
            WHERE u.id = @UserId LIMIT 1",
            new { UserId = userId });

    public Task<decimal> GetDailyTradingAverageAsync(Guid userId)
        => _db.ExecuteScalarAsync<decimal>(@"
            SELECT COALESCE(AVG(daily_total), 0)
            FROM (
                SELECT DATE(executed_at) AS day, SUM(quantity * price) AS daily_total
                FROM trading.trades
                WHERE (buyer_id = @UserId OR seller_id = @UserId)
                  AND executed_at >= NOW() - INTERVAL '30 days'
                GROUP BY 1
            ) t",
            new { UserId = userId })!;

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
    }
}
