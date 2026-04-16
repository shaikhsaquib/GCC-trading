using GccBond.Settlement.Interfaces;
using GccBond.Shared.Exceptions;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using Serilog;

namespace GccBond.Settlement.Services;

/// <summary>
/// T+1 settlement processor (FSD §6.6, §14.3).
/// No SQL — all data access goes through ISettlementRepository.
/// </summary>
public class SettlementService : ISettlementService
{
    private readonly ISettlementRepository _repo;
    private readonly IEventBus             _eventBus;
    private const int MaxRetries = 3;

    public SettlementService(ISettlementRepository repo, IEventBus eventBus)
    {
        _repo     = repo;
        _eventBus = eventBus;
    }

    public async Task RunDailyBatchAsync()
    {
        Log.Information("Settlement batch starting for {Date}", DateTime.UtcNow.Date);

        var pending = await _repo.GetPendingAsync(MaxRetries);
        var list    = pending.ToList();

        Log.Information("Processing {Count} settlements", list.Count);

        foreach (var settlement in list)
            await ProcessSettlementAsync(settlement);

        Log.Information("Settlement batch complete");
    }

    public async Task ProcessSettlementAsync(Settlement settlement)
    {
        try
        {
            await _repo.MarkProcessingAsync(settlement.Id);

            var trade = await _repo.GetTradeAsync(settlement.TradeId)
                ?? throw new NotFoundException($"Trade {settlement.TradeId}");

            await _repo.MarkCompletedAsync(settlement.Id, trade.BuyOrderId, trade.SellOrderId, trade);

            await _eventBus.PublishAsync(Events.SettlementDone, new
            {
                settlement_id = settlement.Id,
                trade_id      = settlement.TradeId,
                buyer_id      = trade.BuyerId,
                seller_id     = trade.SellerId,
                bond_id       = trade.BondId,
                quantity      = trade.Quantity,
                price         = trade.Price,
            });

            Log.Information("Settlement {Id} completed", settlement.Id);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Settlement {Id} failed (attempt {Retry})", settlement.Id, settlement.RetryCount + 1);

            var newCount = settlement.RetryCount + 1;
            var isFinal  = newCount >= MaxRetries;

            await _repo.MarkFailedAsync(settlement.Id, newCount, ex.Message, isFinal);

            if (isFinal)
            {
                await _eventBus.PublishAsync(Events.SettlementFailed, new
                {
                    settlement_id = settlement.Id,
                    trade_id      = settlement.TradeId,
                    reason        = ex.Message,
                });
            }
        }
    }

    public Task<IEnumerable<Settlement>> GetSettlementsAsync(string? status, int limit, int offset)
        => _repo.GetAllAsync(status, limit, offset);

    public Task<Settlement?> GetByTradeIdAsync(Guid tradeId)
        => _repo.GetByTradeIdAsync(tradeId);
}
