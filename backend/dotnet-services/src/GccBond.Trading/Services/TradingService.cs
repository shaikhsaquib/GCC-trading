using GccBond.Shared.Exceptions;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using GccBond.Trading.DTOs;
using GccBond.Trading.Interfaces;
using Serilog;

namespace GccBond.Trading.Services;

/// <summary>
/// Business logic for order placement and cancellation (FSD §6.4, §8.4).
/// Contains NO SQL — all data access goes through IOrderRepository.
/// </summary>
public class TradingService : ITradingService
{
    private readonly IOrderRepository _orders;
    private readonly DatabaseHelper   _db;
    private readonly RedisHelper      _redis;
    private readonly IEventBus        _eventBus;
    private readonly IMatchingEngine  _matchingEngine;

    // Risk-tiered trade limits (FSD §8.4)
    private static readonly Dictionary<string, decimal> TradeLimits = new()
    {
        ["LOW"]    = 10_000m,
        ["MEDIUM"] = 50_000m,
        ["HIGH"]   = 200_000m,
    };

    public TradingService(
        IOrderRepository orders,
        DatabaseHelper   db,
        RedisHelper      redis,
        IEventBus        eventBus,
        IMatchingEngine  matchingEngine)
    {
        _orders         = orders;
        _db             = db;
        _redis          = redis;
        _eventBus       = eventBus;
        _matchingEngine = matchingEngine;
    }

    public async Task<Order> PlaceOrderAsync(PlaceOrderRequest req)
    {
        // Idempotency check
        var existing = await _orders.GetByIdempotencyKeyAsync(req.IdempotencyKey);
        if (existing is not null) return existing;

        // Trading feature flag
        var tradingEnabled = await _redis.GetFeatureFlagAsync("ENABLE_TRADING");
        if (!tradingEnabled)
            throw new BusinessRuleException("Trading is currently disabled");

        // Load bond
        var bond = await _db.QueryFirstOrDefaultAsync<BondListing>(
            "SELECT * FROM bonds.listings WHERE id = @Id AND status = 'Active'",
            new { Id = req.BondId });
        if (bond is null) throw new NotFoundException("Bond");

        // Load user risk profile
        var riskRow = await _db.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT risk_level FROM kyc.submissions WHERE user_id = @UserId AND status = 'Approved' ORDER BY created_at DESC LIMIT 1",
            new { req.UserId });
        var riskLevel = (string?)riskRow?.risk_level ?? "LOW";

        // Validate trade value vs risk limit
        var price      = req.Price ?? bond.CurrentPrice;
        var tradeValue = req.Quantity * price;
        var limit      = TradeLimits.GetValueOrDefault(riskLevel.ToUpper(), 10_000m);

        if (tradeValue > limit)
            throw new BusinessRuleException(
                $"Trade value {tradeValue:F2} AED exceeds {riskLevel} risk limit of {limit:F2} AED");

        if (req.Side == OrderSide.Buy && req.Quantity < bond.MinInvestment)
            throw new BusinessRuleException($"Minimum investment is {bond.MinInvestment:F2}");

        if (req.OrderType == OrderType.Limit && req.Price is null)
            throw new ValidationException("Price is required for limit orders");

        // Freeze funds for buy orders
        if (req.Side == OrderSide.Buy)
            await FreezeFundsAsync(req.UserId, tradeValue);

        var order = new Order
        {
            Id             = Guid.NewGuid(),
            UserId         = req.UserId,
            BondId         = req.BondId,
            Side           = req.Side,
            OrderType      = req.OrderType,
            Quantity       = req.Quantity,
            FilledQuantity = 0,
            Price          = req.Price,
            Status         = OrderStatus.Open,
            ExpiresAt      = req.ExpiresAt,
            IdempotencyKey = req.IdempotencyKey,
            CreatedAt      = DateTime.UtcNow,
            UpdatedAt      = DateTime.UtcNow,
        };

        var created = await _orders.CreateAsync(order);

        // Add to Redis order book cache
        await AddToOrderBookAsync(created);

        // Trigger matching engine (non-blocking background task)
        _ = Task.Run(() => _matchingEngine.MatchAsync(created));

        return created;
    }

    public async Task<Order> CancelOrderAsync(Guid orderId, Guid userId)
    {
        var order = await _orders.GetByIdAndUserAsync(orderId, userId)
            ?? throw new NotFoundException("Order");

        if (order.Status is not (OrderStatus.Open or OrderStatus.PartiallyFilled))
            throw new BusinessRuleException($"Cannot cancel order in status {order.Status}");

        await _orders.UpdateStatusAsync(orderId, OrderStatus.Cancelled, "User cancelled");
        await RemoveFromOrderBookAsync(order);

        // Unfreeze remaining frozen funds
        if (order.Side == OrderSide.Buy)
        {
            var unfilled  = order.Quantity - order.FilledQuantity;
            var frozenAmt = unfilled * (order.Price ?? 0);
            if (frozenAmt > 0) await UnfreezeFundsAsync(userId, frozenAmt);
        }

        await _eventBus.PublishAsync(Events.OrderCancelled,
            new { order_id = orderId, user_id = userId });

        return order with { Status = OrderStatus.Cancelled };
    }

    public Task<Order?> GetOrderAsync(Guid orderId, Guid userId)
        => _orders.GetByIdAndUserAsync(orderId, userId);

    public Task<IEnumerable<Order>> GetUserOrdersAsync(Guid userId, string? status, int limit, int offset)
        => _orders.GetUserOrdersAsync(userId, status, limit, offset);

    public async Task<OrderBookResponse> GetOrderBookAsync(Guid bondId, int depth)
    {
        var (bids, asks) = await _orders.GetOrderBookAsync(bondId, depth);
        return new OrderBookResponse
        {
            Bids = bids.Select(b => new OrderBookLevel { Price = (decimal)b.price, Quantity = (decimal)b.quantity, Orders = (int)b.orders }),
            Asks = asks.Select(a => new OrderBookLevel { Price = (decimal)a.price, Quantity = (decimal)a.quantity, Orders = (int)a.orders }),
        };
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task AddToOrderBookAsync(Order order)
    {
        var key = $"order-book:{order.BondId}:";
        if (order.Side == OrderSide.Buy)
        {
            var score = order.OrderType == OrderType.Market ? double.MaxValue : -(double)(order.Price ?? 0);
            await _redis.OrderBookAddAsync(key + "buy", order.Id.ToString(), score);
        }
        else
        {
            var score = order.OrderType == OrderType.Market ? 0.0 : (double)(order.Price ?? 0);
            await _redis.OrderBookAddAsync(key + "sell", order.Id.ToString(), score);
        }
    }

    private async Task RemoveFromOrderBookAsync(Order order)
    {
        var side = order.Side == OrderSide.Buy ? "buy" : "sell";
        await _redis.OrderBookRemoveAsync($"order-book:{order.BondId}:{side}", order.Id.ToString());
    }

    private async Task FreezeFundsAsync(Guid userId, decimal amount)
    {
        var rows = await _db.ExecuteAsync(@"
            UPDATE wallet.wallets
            SET available_balance = available_balance - @Amount,
                frozen_balance    = frozen_balance    + @Amount,
                updated_at        = NOW()
            WHERE user_id = @UserId AND available_balance >= @Amount",
            new { UserId = userId, Amount = amount });

        if (rows == 0)
            throw new BusinessRuleException("Insufficient available balance");
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
