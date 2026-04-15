using Dapper;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using Serilog;

namespace GccBond.Settlement.Services;

/// <summary>
/// T+1 settlement processor (FSD §6.6, §14.3).
/// Batch runs at 06:00 UTC daily via Hangfire.
/// Handles ownership transfer, fee deduction, and reconciliation.
/// </summary>
public class SettlementService
{
    private readonly DatabaseHelper _db;
    private readonly IEventBus      _eventBus;
    private const int MaxRetries    = 3;

    public SettlementService(DatabaseHelper db, IEventBus eventBus)
    {
        _db       = db;
        _eventBus = eventBus;
    }

    // ── Daily Settlement Batch ─────────────────────────────────────────────────

    public async Task RunDailyBatchAsync()
    {
        Log.Information("Settlement batch starting for {Date}", DateTime.UtcNow.Date);

        var pending = await _db.QueryAsync<GccBond.Shared.Models.Settlement>(@"
            SELECT s.*
            FROM settlement.settlements s
            JOIN trading.trades t ON t.id = s.trade_id
            WHERE s.status IN ('Pending', 'Processing')
              AND s.settlement_date <= @Today
              AND s.retry_count < @MaxRetries
            ORDER BY s.settlement_date ASC",
            new { Today = DateTime.UtcNow.Date, MaxRetries });

        Log.Information("Processing {Count} settlements", pending.Count());

        foreach (var settlement in pending)
        {
            await ProcessSettlementAsync(settlement);
        }

        Log.Information("Settlement batch complete");
    }

    // ── Process Single Settlement ──────────────────────────────────────────────

    public async Task ProcessSettlementAsync(GccBond.Shared.Models.Settlement settlement)
    {
        try
        {
            // Mark as Processing
            await _db.ExecuteAsync(@"
                UPDATE settlement.settlements
                SET status = 'Processing', updated_at = @Now
                WHERE id = @Id",
                new { settlement.Id, Now = DateTime.UtcNow });

            // Load trade
            var trade = await _db.QueryFirstOrDefaultAsync<Trade>(
                "SELECT * FROM trading.trades WHERE id = @Id",
                new { Id = settlement.TradeId });

            if (trade is null)
                throw new InvalidOperationException($"Trade {settlement.TradeId} not found");

            await _db.TransactionAsync(async (conn, tx) =>
            {
                // 1. Transfer bond ownership: debit seller, credit buyer
                await TransferBondOwnershipAsync(conn, tx, trade);

                // 2. Transfer cash: debit buyer, credit seller (minus fees)
                await SettleCashAsync(conn, tx, trade);

                // 3. Release frozen funds for buyer
                await ReleaseFrozenFundsAsync(conn, tx, trade);

                // 4. Mark settlement complete
                await conn.ExecuteAsync(@"
                    UPDATE settlement.settlements
                    SET status = 'Completed', updated_at = @Now
                    WHERE id = @Id",
                    new { settlement.Id, Now = DateTime.UtcNow }, tx);

                // 5. Update order to PendingSettlement → Settled
                await conn.ExecuteAsync(@"
                    UPDATE trading.orders
                    SET status = 'Settled', updated_at = @Now
                    WHERE id IN (@BuyOrderId, @SellOrderId)
                      AND status IN ('Filled', 'PendingSettlement')",
                    new { trade.BuyOrderId, trade.SellOrderId, Now = DateTime.UtcNow }, tx);
            });

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
            var newStatus = newCount >= MaxRetries ? "Failed" : "Pending";

            await _db.ExecuteAsync(@"
                UPDATE settlement.settlements
                SET status = @Status, retry_count = @Count, failure_reason = @Reason, updated_at = @Now
                WHERE id = @Id",
                new { settlement.Id, Status = newStatus, Count = newCount, Reason = ex.Message, Now = DateTime.UtcNow });

            if (newStatus == "Failed")
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

    // ── Bond Ownership Transfer ────────────────────────────────────────────────

    private static async Task TransferBondOwnershipAsync(
        System.Data.IDbConnection conn,
        System.Data.IDbTransaction tx,
        Trade trade)
    {
        // Debit seller's holding
        await conn.ExecuteAsync(@"
            UPDATE portfolio.holdings
            SET quantity   = quantity - @Quantity,
                updated_at = NOW()
            WHERE user_id = @SellerId AND bond_id = @BondId AND quantity >= @Quantity",
            new { trade.SellerId, trade.BondId, trade.Quantity }, tx);

        // Credit buyer's holding (upsert)
        await conn.ExecuteAsync(@"
            INSERT INTO portfolio.holdings
                (id, user_id, bond_id, quantity, avg_buy_price, current_value, unrealized_pnl,
                 total_coupon_received, updated_at)
            VALUES
                (gen_random_uuid(), @BuyerId, @BondId, @Quantity, @Price,
                 @Quantity * @Price, 0, 0, NOW())
            ON CONFLICT (user_id, bond_id) DO UPDATE
            SET
                avg_buy_price = (holdings.avg_buy_price * holdings.quantity + @Price * @Quantity)
                                / (holdings.quantity + @Quantity),
                quantity      = holdings.quantity + @Quantity,
                updated_at    = NOW()",
            new { trade.BuyerId, trade.BondId, trade.Quantity, Price = trade.Price }, tx);
    }

    // ── Cash Settlement ────────────────────────────────────────────────────────

    private static async Task SettleCashAsync(
        System.Data.IDbConnection conn,
        System.Data.IDbTransaction tx,
        Trade trade)
    {
        decimal tradeValue   = trade.Quantity * trade.Price;
        decimal sellerAmount = tradeValue - trade.SellerFee - trade.SettlementFee;

        // Credit seller's wallet (net of fees)
        await conn.ExecuteAsync(@"
            UPDATE wallet.wallets
            SET available_balance = available_balance + @Amount,
                balance           = balance           + @Amount,
                updated_at        = NOW()
            WHERE user_id = @SellerId",
            new { trade.SellerId, Amount = sellerAmount }, tx);

        // Record seller credit transaction
        await conn.ExecuteAsync(@"
            INSERT INTO wallet.transactions
                (id, wallet_id, type, amount, currency, status, reference_id, description, idempotency_key, created_at)
            SELECT
                gen_random_uuid(), w.id, 'CREDIT', @Amount, w.currency, 'COMPLETED',
                @TradeId, 'Bond sale proceeds', @IdempotencyKey, NOW()
            FROM wallet.wallets w WHERE w.user_id = @SellerId",
            new
            {
                trade.SellerId,
                Amount         = sellerAmount,
                TradeId        = trade.Id.ToString(),
                IdempotencyKey = $"settle-seller-{trade.Id}",
            }, tx);
    }

    private static async Task ReleaseFrozenFundsAsync(
        System.Data.IDbConnection conn,
        System.Data.IDbTransaction tx,
        Trade trade)
    {
        decimal tradeValue  = trade.Quantity * trade.Price;
        decimal buyerTotal  = tradeValue + trade.BuyerFee;

        // Debit buyer frozen balance (release what was frozen)
        await conn.ExecuteAsync(@"
            UPDATE wallet.wallets
            SET frozen_balance = frozen_balance - @Amount,
                balance        = balance        - @Amount,
                updated_at     = NOW()
            WHERE user_id = @BuyerId",
            new { trade.BuyerId, Amount = buyerTotal }, tx);

        // Record buyer debit transaction
        await conn.ExecuteAsync(@"
            INSERT INTO wallet.transactions
                (id, wallet_id, type, amount, currency, status, reference_id, description, idempotency_key, created_at)
            SELECT
                gen_random_uuid(), w.id, 'DEBIT', @Amount, w.currency, 'COMPLETED',
                @TradeId, 'Bond purchase settlement', @IdempotencyKey, NOW()
            FROM wallet.wallets w WHERE w.user_id = @BuyerId",
            new
            {
                trade.BuyerId,
                Amount         = buyerTotal,
                TradeId        = trade.Id.ToString(),
                IdempotencyKey = $"settle-buyer-{trade.Id}",
            }, tx);
    }

    // ── Queries ────────────────────────────────────────────────────────────────

    public async Task<IEnumerable<GccBond.Shared.Models.Settlement>> GetSettlementsAsync(
        string? status = null, int limit = 50, int offset = 0)
    {
        var sql = status is null
            ? "SELECT * FROM settlement.settlements ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset"
            : "SELECT * FROM settlement.settlements WHERE status = @Status ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset";
        return await _db.QueryAsync<GccBond.Shared.Models.Settlement>(
            sql, new { Status = status, Limit = limit, Offset = offset });
    }

    public async Task<GccBond.Shared.Models.Settlement?> GetSettlementByTradeAsync(Guid tradeId)
        => await _db.QueryFirstOrDefaultAsync<GccBond.Shared.Models.Settlement>(
            "SELECT * FROM settlement.settlements WHERE trade_id = @TradeId",
            new { TradeId = tradeId });
}
