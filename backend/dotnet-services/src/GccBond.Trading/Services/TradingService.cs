using Dapper;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using Serilog;

namespace GccBond.Trading.Services;

public record PlaceOrderRequest
{
    public Guid      UserId        { get; init; }
    public Guid      BondId        { get; init; }
    public OrderSide Side          { get; init; }
    public OrderType OrderType     { get; init; }
    public decimal   Quantity      { get; init; }
    public decimal?  Price         { get; init; }
    public DateTime? ExpiresAt     { get; init; }
    public string    IdempotencyKey{ get; init; } = "";
}

public class TradingService
{
    private readonly DatabaseHelper _db;
    private readonly RedisHelper    _redis;
    private readonly IEventBus      _eventBus;
    private readonly MatchingEngine _matchingEngine;

    // Risk-tiered trade limits (FSD §8.4)
    private static readonly Dictionary<string, decimal> TradeLimits = new()
    {
        ["LOW"]    = 10_000m,
        ["MEDIUM"] = 50_000m,
        ["HIGH"]   = 200_000m,
    };

    public TradingService(DatabaseHelper db, RedisHelper redis, IEventBus eventBus, MatchingEngine matchingEngine)
    {
        _db             = db;
        _redis          = redis;
        _eventBus       = eventBus;
        _matchingEngine = matchingEngine;
    }

    // ── Place Order ────────────────────────────────────────────────────────────

    public async Task<Order> PlaceOrderAsync(PlaceOrderRequest req)
    {
        // Idempotency check
        var existing = await _db.QueryFirstOrDefaultAsync<Order>(
            "SELECT * FROM trading.orders WHERE idempotency_key = @Key",
            new { Key = req.IdempotencyKey });
        if (existing is not null) return existing;

        // Trading enabled?
        var tradingEnabled = await _redis.GetFeatureFlagAsync("ENABLE_TRADING");
        if (!tradingEnabled)
            throw new InvalidOperationException("Trading is currently disabled");

        // Load bond
        var bond = await _db.QueryFirstOrDefaultAsync<BondListing>(
            "SELECT * FROM bonds.listings WHERE id = @Id AND status = 'Active'",
            new { Id = req.BondId });
        if (bond is null) throw new KeyNotFoundException("Bond not found or not active");

        // Load user risk profile
        var riskRow = await _db.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT risk_level FROM kyc.submissions WHERE user_id = @UserId AND status = 'Approved' ORDER BY created_at DESC LIMIT 1",
            new { req.UserId });
        var riskLevel = (string?)riskRow?.risk_level ?? "LOW";

        // Validate trade value vs risk limit
        var price     = req.Price ?? bond.CurrentPrice;
        var tradeValue= req.Quantity * price;
        var limit     = TradeLimits.GetValueOrDefault(riskLevel.ToUpper(), 10_000m);
        if (tradeValue > limit)
            throw new InvalidOperationException($"Trade value {tradeValue:F2} AED exceeds risk limit {limit:F2} AED for {riskLevel} risk profile");

        // Validate minimum investment for buy orders
        if (req.Side == OrderSide.Buy && req.Quantity < bond.MinInvestment)
            throw new InvalidOperationException($"Minimum investment is {bond.MinInvestment:F2}");

        // Validate limit order has a price
        if (req.OrderType == OrderType.Limit && req.Price is null)
            throw new ArgumentException("Limit order requires a price");

        // For buy orders: check and freeze wallet funds
        if (req.Side == OrderSide.Buy)
            await FreezeFundsAsync(req.UserId, tradeValue);

        var orderId = Guid.NewGuid();
        var now     = DateTime.UtcNow;

        var order = await _db.TransactionAsync(async (conn, tx) =>
        {
            await conn.ExecuteAsync(@"
                INSERT INTO trading.orders
                    (id, user_id, bond_id, side, order_type, quantity, filled_quantity,
                     price, avg_fill_price, status, expires_at, idempotency_key, created_at, updated_at)
                VALUES
                    (@Id, @UserId, @BondId, @Side, @OrderType, @Quantity, 0,
                     @Price, NULL, 'Open', @ExpiresAt, @IdempotencyKey, @Now, @Now)",
                new
                {
                    Id             = orderId,
                    req.UserId,
                    req.BondId,
                    Side           = req.Side.ToString(),
                    OrderType      = req.OrderType.ToString(),
                    req.Quantity,
                    req.Price,
                    req.ExpiresAt,
                    req.IdempotencyKey,
                    Now            = now,
                }, tx);

            return await conn.QueryFirstOrDefaultAsync<Order>(
                "SELECT * FROM trading.orders WHERE id = @Id", new { Id = orderId }, tx);
        });

        // Add to Redis order book cache
        await AddToOrderBook(order!);

        // Trigger matching engine (non-blocking — runs in background task)
        _ = Task.Run(() => _matchingEngine.MatchAsync(order!));

        return order!;
    }

    // ── Cancel Order ───────────────────────────────────────────────────────────

    public async Task<Order> CancelOrderAsync(Guid orderId, Guid userId)
    {
        var order = await _db.QueryFirstOrDefaultAsync<Order>(
            "SELECT * FROM trading.orders WHERE id = @Id AND user_id = @UserId",
            new { Id = orderId, UserId = userId });

        if (order is null) throw new KeyNotFoundException("Order not found");

        if (order.Status is not (OrderStatus.Open or OrderStatus.PartiallyFilled))
            throw new InvalidOperationException($"Cannot cancel order in status {order.Status}");

        await _db.ExecuteAsync(@"
            UPDATE trading.orders
            SET status = 'Cancelled', cancel_reason = 'User cancelled', updated_at = @Now
            WHERE id = @Id",
            new { Id = orderId, Now = DateTime.UtcNow });

        // Remove from Redis order book
        await RemoveFromOrderBook(order);

        // Unfreeze wallet funds for buy orders
        if (order.Side == OrderSide.Buy)
        {
            var unfilled  = order.Quantity - order.FilledQuantity;
            var frozenAmt = unfilled * (order.Price ?? 0);
            if (frozenAmt > 0)
                await UnfreezeFundsAsync(userId, frozenAmt);
        }

        await _eventBus.PublishAsync(Events.OrderCancelled, new { order_id = orderId, user_id = userId });

        return order with { Status = OrderStatus.Cancelled };
    }

    // ── Query ──────────────────────────────────────────────────────────────────

    public async Task<Order?> GetOrderAsync(Guid orderId, Guid userId)
        => await _db.QueryFirstOrDefaultAsync<Order>(
            "SELECT * FROM trading.orders WHERE id = @Id AND user_id = @UserId",
            new { Id = orderId, UserId = userId });

    public async Task<IEnumerable<Order>> GetUserOrdersAsync(Guid userId, string? status = null, int limit = 50, int offset = 0)
    {
        var sql = status is null
            ? "SELECT * FROM trading.orders WHERE user_id = @UserId ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset"
            : "SELECT * FROM trading.orders WHERE user_id = @UserId AND status = @Status ORDER BY created_at DESC LIMIT @Limit OFFSET @Offset";
        return await _db.QueryAsync<Order>(sql, new { UserId = userId, Status = status, Limit = limit, Offset = offset });
    }

    public async Task<IEnumerable<dynamic>> GetOrderBookAsync(Guid bondId, int depth = 20)
    {
        var buys = await _db.QueryAsync<dynamic>(@"
            SELECT price, SUM(quantity - filled_quantity) AS quantity, COUNT(*) AS orders
            FROM trading.orders
            WHERE bond_id = @BondId AND side = 'Buy' AND status IN ('Open','PartiallyFilled')
            GROUP BY price ORDER BY price DESC LIMIT @Depth",
            new { BondId = bondId, Depth = depth });

        var sells = await _db.QueryAsync<dynamic>(@"
            SELECT price, SUM(quantity - filled_quantity) AS quantity, COUNT(*) AS orders
            FROM trading.orders
            WHERE bond_id = @BondId AND side = 'Sell' AND status IN ('Open','PartiallyFilled')
            GROUP BY price ORDER BY price ASC LIMIT @Depth",
            new { BondId = bondId, Depth = depth });

        return new { bids = buys, asks = sells } as dynamic;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task AddToOrderBook(Order order)
    {
        var bondId = order.BondId.ToString();
        if (order.Side == OrderSide.Buy)
        {
            // Negate price so highest price sorts first (ascending order)
            var score = order.OrderType == OrderType.Market ? double.MaxValue : -(double)(order.Price ?? 0);
            await _redis.OrderBookAddAsync($"order-book:{bondId}:buy", order.Id.ToString(), score);
        }
        else
        {
            var score = order.OrderType == OrderType.Market ? 0.0 : (double)(order.Price ?? 0);
            await _redis.OrderBookAddAsync($"order-book:{bondId}:sell", order.Id.ToString(), score);
        }
    }

    private async Task RemoveFromOrderBook(Order order)
    {
        var bondId = order.BondId.ToString();
        var key    = order.Side == OrderSide.Buy ? $"order-book:{bondId}:buy" : $"order-book:{bondId}:sell";
        await _redis.OrderBookRemoveAsync(key, order.Id.ToString());
    }

    private async Task FreezeFundsAsync(Guid userId, decimal amount)
    {
        // Call wallet service via DB (shared PostgreSQL) — freeze funds to prevent double-spending
        var rows = await _db.ExecuteAsync(@"
            UPDATE wallet.wallets
            SET available_balance = available_balance - @Amount,
                frozen_balance    = frozen_balance    + @Amount,
                updated_at        = NOW()
            WHERE user_id = @UserId AND available_balance >= @Amount",
            new { UserId = userId, Amount = amount });

        if (rows == 0)
            throw new InvalidOperationException("Insufficient available balance");
    }

    private Task UnfreezeFundsAsync(Guid userId, decimal amount)
        => _db.ExecuteAsync(@"
            UPDATE wallet.wallets
            SET available_balance = available_balance + @Amount,
                frozen_balance    = frozen_balance    - @Amount,
                updated_at        = NOW()
            WHERE user_id = @UserId",
            new { UserId = userId, Amount = amount });
}
