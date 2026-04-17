using Dapper;
using GccBond.Settlement.Interfaces;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using SettlementModel = GccBond.Shared.Models.Settlement;

namespace GccBond.Settlement.Repositories;

public class SettlementRepository : ISettlementRepository
{
    private readonly DatabaseHelper _db;

    public SettlementRepository(DatabaseHelper db) => _db = db;

    public Task<IEnumerable<SettlementModel>> GetPendingAsync(int maxRetries)
        => _db.QueryAsync<SettlementModel>(@"
            SELECT s.* FROM settlement.settlements s
            WHERE s.status IN ('Pending','Processing')
              AND s.settlement_date <= @Today
              AND s.retry_count < @MaxRetries
            ORDER BY s.settlement_date ASC",
            new { Today = DateTime.UtcNow.Date, MaxRetries = maxRetries });

    public Task<SettlementModel?> GetByTradeIdAsync(Guid tradeId)
        => _db.QueryFirstOrDefaultAsync<SettlementModel>(
            "SELECT * FROM settlement.settlements WHERE trade_id = @TradeId",
            new { TradeId = tradeId });

    public Task<IEnumerable<SettlementModel>> GetAllAsync(string? status, int limit, int offset)
    {
        var sql = status is null
            ? "SELECT * FROM settlement.settlements ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset"
            : "SELECT * FROM settlement.settlements WHERE status = @Status ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset";
        return _db.QueryAsync<SettlementModel>(sql, new { Status = status, Limit = limit, Offset = offset });
    }

    public Task<Trade?> GetTradeAsync(Guid tradeId)
        => _db.QueryFirstOrDefaultAsync<Trade>(
            "SELECT * FROM trading.trades WHERE id = @Id", new { Id = tradeId });

    public Task MarkProcessingAsync(Guid settlementId)
        => _db.ExecuteAsync(
            "UPDATE settlement.settlements SET status = 'Processing', updated_at = @Now WHERE id = @Id",
            new { Id = settlementId, Now = DateTime.UtcNow });

    public Task MarkCompletedAsync(Guid settlementId, Guid buyOrderId, Guid sellOrderId, Trade trade)
        => _db.TransactionAsync(async (conn, tx) =>
        {
            // Transfer bond ownership: debit seller
            await conn.ExecuteAsync(@"
                UPDATE portfolio.holdings
                SET quantity = quantity - @Quantity, updated_at = NOW()
                WHERE user_id = @SellerId AND bond_id = @BondId AND quantity >= @Quantity",
                new { trade.SellerId, trade.BondId, trade.Quantity }, tx);

            // Credit buyer (upsert)
            await conn.ExecuteAsync(@"
                INSERT INTO portfolio.holdings
                    (id, user_id, bond_id, quantity, avg_buy_price, current_value,
                     unrealized_pnl, total_coupon_received, updated_at)
                VALUES (gen_random_uuid(), @BuyerId, @BondId, @Quantity, @Price,
                        @Quantity * @Price, 0, 0, NOW())
                ON CONFLICT (user_id, bond_id) DO UPDATE
                SET avg_buy_price = (holdings.avg_buy_price * holdings.quantity + @Price * @Quantity)
                                    / (holdings.quantity + @Quantity),
                    quantity = holdings.quantity + @Quantity,
                    updated_at = NOW()",
                new { trade.BuyerId, trade.BondId, trade.Quantity, Price = trade.Price }, tx);

            // Cash settlement — credit seller net of fees
            var sellerAmount = trade.Quantity * trade.Price - trade.SellerFee - trade.SettlementFee;
            await conn.ExecuteAsync(@"
                UPDATE wallet.wallets
                SET available_balance = available_balance + @Amount,
                    balance = balance + @Amount, updated_at = NOW()
                WHERE user_id = @SellerId",
                new { trade.SellerId, Amount = sellerAmount }, tx);

            // Release buyer frozen funds
            var buyerTotal = trade.Quantity * trade.Price + trade.BuyerFee;
            await conn.ExecuteAsync(@"
                UPDATE wallet.wallets
                SET frozen_balance = frozen_balance - @Amount,
                    balance = balance - @Amount, updated_at = NOW()
                WHERE user_id = @BuyerId",
                new { trade.BuyerId, Amount = buyerTotal }, tx);

            // Mark settlement complete
            await conn.ExecuteAsync(
                "UPDATE settlement.settlements SET status = 'Completed', updated_at = @Now WHERE id = @Id",
                new { Id = settlementId, Now = DateTime.UtcNow }, tx);

            // Mark orders settled
            await conn.ExecuteAsync(@"
                UPDATE trading.orders SET status = 'Settled', updated_at = @Now
                WHERE id IN (@BuyOrderId, @SellOrderId) AND status IN ('Filled','PendingSettlement')",
                new { BuyOrderId = buyOrderId, SellOrderId = sellOrderId, Now = DateTime.UtcNow }, tx);
        });

    public Task MarkFailedAsync(Guid settlementId, int retryCount, string reason, bool isFinal)
        => _db.ExecuteAsync(@"
            UPDATE settlement.settlements
            SET status = @Status, retry_count = @Count,
                failure_reason = @Reason, updated_at = @Now
            WHERE id = @Id",
            new
            {
                Id     = settlementId,
                Status = isFinal ? "Failed" : "Pending",
                Count  = retryCount,
                Reason = reason,
                Now    = DateTime.UtcNow,
            });
}
