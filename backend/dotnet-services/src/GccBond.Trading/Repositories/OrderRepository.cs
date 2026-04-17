using Dapper;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using GccBond.Trading.Interfaces;

namespace GccBond.Trading.Repositories;

/// <summary>
/// All SQL for the trading domain lives here.
/// Services contain only business logic; repositories contain only data access.
/// </summary>
public class OrderRepository : IOrderRepository
{
    private readonly DatabaseHelper _db;

    public OrderRepository(DatabaseHelper db) => _db = db;

    public Task<Order?> GetByIdAsync(Guid id)
        => _db.QueryFirstOrDefaultAsync<Order>(
            "SELECT * FROM trading.orders WHERE id = @Id", new { Id = id });

    public Task<Order?> GetByIdAndUserAsync(Guid id, Guid userId)
        => _db.QueryFirstOrDefaultAsync<Order>(
            "SELECT * FROM trading.orders WHERE id = @Id AND user_id = @UserId",
            new { Id = id, UserId = userId });

    public Task<Order?> GetByIdempotencyKeyAsync(string key)
        => _db.QueryFirstOrDefaultAsync<Order>(
            "SELECT * FROM trading.orders WHERE idempotency_key = @Key", new { Key = key });

    public Task<IEnumerable<Order>> GetUserOrdersAsync(Guid userId, string? status, int limit, int offset)
    {
        var sql = status is null
            ? "SELECT * FROM trading.orders WHERE user_id = @UserId ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset"
            : "SELECT * FROM trading.orders WHERE user_id = @UserId AND status = @Status ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset";
        return _db.QueryAsync<Order>(sql, new { UserId = userId, Status = status, Limit = limit, Offset = offset });
    }

    public async Task<Order> CreateAsync(Order order)
    {
        await _db.ExecuteAsync(@"
            INSERT INTO trading.orders
                (id, user_id, bond_id, side, order_type, quantity, filled_quantity,
                 price, avg_fill_price, status, expires_at, idempotency_key, created_at, updated_at)
            VALUES
                (@Id, @UserId, @BondId, @Side, @OrderType, @Quantity, 0,
                 @Price, NULL, 'Open', @ExpiresAt, @IdempotencyKey, @CreatedAt, @UpdatedAt)",
            new
            {
                order.Id, order.UserId, order.BondId,
                Side      = order.Side.ToString(),
                OrderType = order.OrderType.ToString(),
                order.Quantity, order.Price, order.ExpiresAt,
                order.IdempotencyKey,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });

        return (await GetByIdAsync(order.Id))!;
    }

    public Task UpdateStatusAsync(Guid id, OrderStatus status, string? cancelReason = null)
        => _db.ExecuteAsync(@"
            UPDATE trading.orders
            SET status = @Status, cancel_reason = @CancelReason, updated_at = @Now
            WHERE id = @Id",
            new { Id = id, Status = status.ToString(), CancelReason = cancelReason, Now = DateTime.UtcNow });

    public Task UpdateFillAsync(Guid id, decimal fillQty, decimal fillPrice, DateTime now)
        => _db.ExecuteAsync(@"
            UPDATE trading.orders
            SET
                filled_quantity = filled_quantity + @FillQty,
                avg_fill_price  = CASE
                    WHEN filled_quantity = 0 THEN @FillPrice
                    ELSE (avg_fill_price * filled_quantity + @FillPrice * @FillQty)
                         / (filled_quantity + @FillQty)
                    END,
                status = CASE
                    WHEN filled_quantity + @FillQty >= quantity THEN 'Filled'
                    ELSE 'PartiallyFilled'
                    END,
                updated_at = @Now
            WHERE id = @Id",
            new { Id = id, FillQty = fillQty, FillPrice = fillPrice, Now = now });

    public Task<Order?> FindBestCounterpartyAsync(Guid bondId, OrderSide oppositeSide, decimal? price, OrderType type)
    {
        if (oppositeSide == OrderSide.Sell)
        {
            return _db.QueryFirstOrDefaultAsync<Order>(@"
                SELECT * FROM trading.orders
                WHERE bond_id = @BondId AND side = 'Sell'
                  AND status IN ('Open','PartiallyFilled')
                  AND (order_type = 'Market' OR price <= @Price OR @OrderType = 'Market')
                ORDER BY CASE WHEN order_type='Market' THEN 0 ELSE 1 END,
                         price ASC, created_at ASC
                LIMIT 1 FOR UPDATE SKIP LOCKED",
                new { BondId = bondId, Price = price, OrderType = type.ToString() });
        }

        return _db.QueryFirstOrDefaultAsync<Order>(@"
            SELECT * FROM trading.orders
            WHERE bond_id = @BondId AND side = 'Buy'
              AND status IN ('Open','PartiallyFilled')
              AND (order_type = 'Market' OR price >= @Price OR @OrderType = 'Market')
            ORDER BY CASE WHEN order_type='Market' THEN 0 ELSE 1 END,
                     price DESC, created_at ASC
            LIMIT 1 FOR UPDATE SKIP LOCKED",
            new { BondId = bondId, Price = price, OrderType = type.ToString() });
    }

    public async Task<(IEnumerable<dynamic> Bids, IEnumerable<dynamic> Asks)> GetOrderBookAsync(Guid bondId, int depth)
    {
        var bids = await _db.QueryAsync<dynamic>(@"
            SELECT price, SUM(quantity - filled_quantity) AS quantity, COUNT(*) AS orders
            FROM trading.orders
            WHERE bond_id = @BondId AND side = 'Buy' AND status IN ('Open','PartiallyFilled')
            GROUP BY price ORDER BY price DESC LIMIT @Depth",
            new { BondId = bondId, Depth = depth });

        var asks = await _db.QueryAsync<dynamic>(@"
            SELECT price, SUM(quantity - filled_quantity) AS quantity, COUNT(*) AS orders
            FROM trading.orders
            WHERE bond_id = @BondId AND side = 'Sell' AND status IN ('Open','PartiallyFilled')
            GROUP BY price ORDER BY price ASC LIMIT @Depth",
            new { BondId = bondId, Depth = depth });

        return (bids, asks);
    }

    public Task CreateTradeAsync(Trade trade)
        => _db.ExecuteAsync(@"
            INSERT INTO trading.trades
                (id, buy_order_id, sell_order_id, buyer_id, seller_id, bond_id,
                 quantity, price, buyer_fee, seller_fee, settlement_fee, executed_at)
            VALUES
                (@Id, @BuyOrderId, @SellOrderId, @BuyerId, @SellerId, @BondId,
                 @Quantity, @Price, @BuyerFee, @SellerFee, @SettlementFee, @ExecutedAt)",
            new
            {
                trade.Id, trade.BuyOrderId, trade.SellOrderId,
                trade.BuyerId, trade.SellerId, trade.BondId,
                trade.Quantity, trade.Price, trade.BuyerFee,
                trade.SellerFee, trade.SettlementFee, trade.ExecutedAt,
            });

    public Task CreateSettlementAsync(Guid tradeId, DateTime tradeDate, DateTime settlementDate)
        => _db.ExecuteAsync(@"
            INSERT INTO settlement.settlements
                (id, trade_id, status, trade_date, settlement_date, retry_count, created_at, updated_at)
            VALUES
                (gen_random_uuid(), @TradeId, 'Pending', @TradeDate, @SettlementDate, 0, NOW(), NOW())",
            new { TradeId = tradeId, TradeDate = tradeDate.Date, SettlementDate = settlementDate.Date });
}
