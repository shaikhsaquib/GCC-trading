using Dapper;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using Serilog;
using StackExchange.Redis;

namespace GccBond.Trading.Services;

/// <summary>
/// Price-time priority matching engine (FSD §14.1).
/// Runs in the Trading service process — one singleton per service instance.
/// Serialises access per bond via distributed Redis locks.
/// </summary>
public class MatchingEngine
{
    private readonly DatabaseHelper _db;
    private readonly RedisHelper    _redis;
    private readonly IEventBus      _eventBus;

    // Trade fee schedule (FSD §8.3)
    private const decimal BuyerFeeRate    = 0.0025m; // 25 bps
    private const decimal SellerFeeRate   = 0.0025m;
    private const decimal SettlementFeeRate = 0.0010m; // 10 bps

    public MatchingEngine(DatabaseHelper db, RedisHelper redis, IEventBus eventBus)
    {
        _db       = db;
        _redis    = redis;
        _eventBus = eventBus;
    }

    /// <summary>
    /// Match an incoming order against the order book.
    /// Called immediately after an order is persisted as Open.
    /// </summary>
    public async Task MatchAsync(Order incomingOrder)
    {
        var bondKey = incomingOrder.BondId.ToString();
        var lockId  = Guid.NewGuid().ToString();

        // Acquire distributed lock for this bond's order book (max 5s)
        var acquired = await _redis.AcquireLockAsync($"matching:{bondKey}", lockId, TimeSpan.FromSeconds(5));
        if (!acquired)
        {
            Log.Warning("Could not acquire matching lock for bond {BondId}", bondKey);
            return;
        }

        try
        {
            await MatchInternalAsync(incomingOrder);
        }
        finally
        {
            await _redis.ReleaseLockAsync($"matching:{bondKey}", lockId);
        }
    }

    private async Task MatchInternalAsync(Order incoming)
    {
        while (true)
        {
            // Find best opposing order from DB (persistent state — Redis order book is a cache)
            Order? counterparty = await FindBestCounterpartyAsync(incoming);
            if (counterparty is null) break;

            // Price check: can they trade?
            if (!PricesMatch(incoming, counterparty)) break;

            decimal fillQty   = Math.Min(incoming.Quantity - incoming.FilledQuantity,
                                         counterparty.Quantity - counterparty.FilledQuantity);
            decimal fillPrice = DetermineTradePrice(incoming, counterparty);

            await ExecuteTradeAsync(incoming, counterparty, fillQty, fillPrice);

            // Refresh quantities from DB
            incoming = (await _db.QueryFirstOrDefaultAsync<Order>(
                "SELECT * FROM trading.orders WHERE id = @Id",
                new { incoming.Id }))!;

            if (incoming.FilledQuantity >= incoming.Quantity) break;
        }
    }

    private async Task<Order?> FindBestCounterpartyAsync(Order incoming)
    {
        // Buy order → match against lowest-priced sell orders (price-time priority)
        // Sell order → match against highest-priced buy orders (price-time priority)
        if (incoming.Side == OrderSide.Buy)
        {
            return await _db.QueryFirstOrDefaultAsync<Order>(@"
                SELECT * FROM trading.orders
                WHERE bond_id     = @BondId
                  AND side        = 'Sell'
                  AND status      IN ('Open', 'PartiallyFilled')
                  AND (order_type = 'Market' OR price <= @Price OR @OrderType = 'Market')
                ORDER BY
                    CASE WHEN order_type = 'Market' THEN 0 ELSE 1 END,
                    price ASC,
                    created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED",
                new { incoming.BondId, Price = incoming.Price, OrderType = incoming.OrderType.ToString() });
        }
        else
        {
            return await _db.QueryFirstOrDefaultAsync<Order>(@"
                SELECT * FROM trading.orders
                WHERE bond_id     = @BondId
                  AND side        = 'Buy'
                  AND status      IN ('Open', 'PartiallyFilled')
                  AND (order_type = 'Market' OR price >= @Price OR @OrderType = 'Market')
                ORDER BY
                    CASE WHEN order_type = 'Market' THEN 0 ELSE 1 END,
                    price DESC,
                    created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED",
                new { incoming.BondId, Price = incoming.Price, OrderType = incoming.OrderType.ToString() });
        }
    }

    private static bool PricesMatch(Order incoming, Order counterparty)
    {
        if (incoming.OrderType == OrderType.Market || counterparty.OrderType == OrderType.Market)
            return true;

        return incoming.Side == OrderSide.Buy
            ? incoming.Price >= counterparty.Price
            : incoming.Price <= counterparty.Price;
    }

    /// <summary>Passive (resting) order's price determines trade price.</summary>
    private static decimal DetermineTradePrice(Order incoming, Order counterparty)
    {
        if (counterparty.OrderType == OrderType.Market && incoming.OrderType != OrderType.Market)
            return incoming.Price ?? 0;
        if (incoming.OrderType == OrderType.Market && counterparty.OrderType != OrderType.Market)
            return counterparty.Price ?? 0;
        // Both limit — use the resting order's price (counterparty was already in book)
        return counterparty.Price ?? 0;
    }

    private async Task ExecuteTradeAsync(Order buy, Order sell, decimal fillQty, decimal fillPrice)
    {
        // Determine which is buyer and which is seller
        var buyOrder  = buy.Side  == OrderSide.Buy  ? buy  : sell;
        var sellOrder = buy.Side  == OrderSide.Sell ? buy  : sell;

        decimal tradeValue     = fillQty * fillPrice;
        decimal buyerFee       = Math.Round(tradeValue * BuyerFeeRate,    4);
        decimal sellerFee      = Math.Round(tradeValue * SellerFeeRate,   4);
        decimal settlementFee  = Math.Round(tradeValue * SettlementFeeRate, 4);

        var tradeId = Guid.NewGuid();
        var now     = DateTime.UtcNow;

        await _db.TransactionAsync(async (conn, tx) =>
        {
            // 1. Insert trade record
            await conn.ExecuteAsync(@"
                INSERT INTO trading.trades
                    (id, buy_order_id, sell_order_id, buyer_id, seller_id, bond_id,
                     quantity, price, buyer_fee, seller_fee, settlement_fee, executed_at)
                VALUES
                    (@TradeId, @BuyOrderId, @SellOrderId, @BuyerId, @SellerId, @BondId,
                     @Quantity, @Price, @BuyerFee, @SellerFee, @SettlementFee, @ExecutedAt)",
                new
                {
                    TradeId      = tradeId,
                    BuyOrderId   = buyOrder.Id,
                    SellOrderId  = sellOrder.Id,
                    BuyerId      = buyOrder.UserId,
                    SellerId     = sellOrder.UserId,
                    BondId       = buyOrder.BondId,
                    Quantity     = fillQty,
                    Price        = fillPrice,
                    BuyerFee     = buyerFee,
                    SellerFee    = sellerFee,
                    SettlementFee= settlementFee,
                    ExecutedAt   = now,
                }, tx);

            // 2. Update buy order
            await UpdateOrderFillAsync(conn, tx, buyOrder.Id, fillQty, fillPrice, now);

            // 3. Update sell order
            await UpdateOrderFillAsync(conn, tx, sellOrder.Id, fillQty, fillPrice, now);

            // 4. Create settlement record (T+1)
            await conn.ExecuteAsync(@"
                INSERT INTO settlement.settlements
                    (id, trade_id, status, trade_date, settlement_date, retry_count, created_at, updated_at)
                VALUES
                    (@Id, @TradeId, 'Pending', @TradeDate, @SettlementDate, 0, @Now, @Now)",
                new
                {
                    Id             = Guid.NewGuid(),
                    TradeId        = tradeId,
                    TradeDate      = now.Date,
                    SettlementDate = now.Date.AddDays(1), // T+1
                    Now            = now,
                }, tx);
        });

        // 5. Publish domain event
        await _eventBus.PublishAsync(Events.TradeExecuted, new
        {
            trade_id   = tradeId,
            buyer_id   = buyOrder.UserId,
            seller_id  = sellOrder.UserId,
            bond_id    = buyOrder.BondId,
            quantity   = fillQty.ToString("F4"),
            price      = fillPrice.ToString("F4"),
            buyer_fee  = buyerFee.ToString("F4"),
            seller_fee = sellerFee.ToString("F4"),
            currency   = "AED",
            executed_at= now,
        });

        Log.Information("Trade executed: {TradeId} qty={Qty} price={Price}", tradeId, fillQty, fillPrice);
    }

    private static async Task UpdateOrderFillAsync(
        System.Data.IDbConnection conn, System.Data.IDbTransaction tx,
        Guid orderId, decimal fillQty, decimal fillPrice, DateTime now)
    {
        await conn.ExecuteAsync(@"
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
            WHERE id = @OrderId",
            new { FillQty = fillQty, FillPrice = fillPrice, Now = now, OrderId = orderId },
            tx);
    }
}
