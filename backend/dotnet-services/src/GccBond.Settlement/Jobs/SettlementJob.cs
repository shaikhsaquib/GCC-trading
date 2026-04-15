using GccBond.Settlement.Services;
using Hangfire;
using Serilog;

namespace GccBond.Settlement.Jobs;

public class SettlementJob
{
    private readonly SettlementService _service;

    public SettlementJob(SettlementService service) => _service = service;

    /// <summary>
    /// Runs daily at 06:00 UTC (T+1 settlement).
    /// Registered as a recurring Hangfire job in Program.cs.
    /// </summary>
    [AutomaticRetry(Attempts = 0)] // Retry handled internally per settlement record
    public async Task RunAsync()
    {
        Log.Information("SettlementJob.RunAsync started at {Time}", DateTime.UtcNow);
        await _service.RunDailyBatchAsync();
    }
}
