using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;
using GccBond.Trading.Interfaces;
using Serilog;

namespace GccBond.Trading.Services;

/// <summary>
/// Price-time priority matching engine (FSD §14.1).
/// Uses distributed Redis lock per bond to prevent concurrent matching.
/// All DB writes go through IOrderRepository.
/// </summary>
public class MatchingEngine : IMatchingEngine
{
    private readonly IOrderRepository _orders;
    private readonly RedisHelper      _redis;
    private readonly IEventBus        _eventBus;

    private const decimal BuyerFeeRate      = 0.0025m; // 25 bps
    private const decimal SellerFeeRate     = 0.0025m;
    private const decimal SettlementFeeRate = 0.0010m; // 10 bps

    public MatchingEngine(IOrderRepository orders, RedisHelper redis, IEventBus eventBus)
    {
        _orders   = orders;
        _redis    = redis;
        _eventBus = eventBus;
    }

    public async Task MatchAsync(Order incomingOrder)
    {
        var bondKey = incomingOrder.BondId.ToString();
        var lockId  = Guid.NewGuid().ToString();

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
            var oppositeSide = incoming.Side == OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy;
            var counterparty = await _orders.FindBestCounterpartyAsync(
                incoming.BondId, oppositeSide, incoming.Price, incoming.OrderType);

            if (counterparty is null || !PricesMatch(incoming, counterparty)) break;

            var fillQty   = Math.Min(
                incoming.Quantity - incoming.FilledQuantity,
                counterparty.Quantity - counterparty.FilledQuantity);
            var fillPrice = DetermineTradePrice(incoming, counterparty);

            await ExecuteTradeAsync(incoming, counterparty, fillQty, fillPrice);

            // Refresh incoming order state from DB
            incoming = (await _orders.GetByIdAsync(incoming.Id))!;
            if (incoming.FilledQuantity >= incoming.Quantity) break;
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

    private static decimal DetermineTradePrice(Order incoming, Order counterparty)
    {
        if (counterparty.OrderType == OrderType.Market && incoming.OrderType != OrderType.Market)
            return incoming.Price ?? 0;
        if (incoming.OrderType == OrderType.Market && counterparty.OrderType != OrderType.Market)
            return counterparty.Price ?? 0;
        return counterparty.Price ?? 0; // resting order's price wins
    }

    private async Task ExecuteTradeAsync(Order buy, Order sell, decimal fillQty, decimal fillPrice)
    {
        var buyOrder  = buy.Side  == OrderSide.Buy  ? buy  : sell;
        var sellOrder = sell.Side == OrderSide.Sell ? sell : buy;

        var tradeValue    = fillQty * fillPrice;
        var buyerFee      = Math.Round(tradeValue * BuyerFeeRate,      4);
        var sellerFee     = Math.Round(tradeValue * SellerFeeRate,     4);
        var settlementFee = Math.Round(tradeValue * SettlementFeeRate, 4);
        var now           = DateTime.UtcNow;

        var trade = new Trade
        {
            Id            = Guid.NewGuid(),
            BuyOrderId    = buyOrder.Id,
            SellOrderId   = sellOrder.Id,
            BuyerId       = buyOrder.UserId,
            SellerId      = sellOrder.UserId,
            BondId        = buyOrder.BondId,
            Quantity      = fillQty,
            Price         = fillPrice,
            BuyerFee      = buyerFee,
            SellerFee     = sellerFee,
            SettlementFee = settlementFee,
            ExecutedAt    = now,
        };

        await _orders.CreateTradeAsync(trade);
        await _orders.UpdateFillAsync(buyOrder.Id,  fillQty, fillPrice, now);
        await _orders.UpdateFillAsync(sellOrder.Id, fillQty, fillPrice, now);
        await _orders.CreateSettlementAsync(trade.Id, now, now.AddDays(1)); // T+1

        await _eventBus.PublishAsync(Events.TradeExecuted, new
        {
            trade_id    = trade.Id,
            buyer_id    = trade.BuyerId,
            seller_id   = trade.SellerId,
            bond_id     = trade.BondId,
            quantity    = fillQty,
            price       = fillPrice,
            buyer_fee   = buyerFee,
            seller_fee  = sellerFee,
            currency    = "AED",
            executed_at = now,
        });

        Log.Information("Trade executed: {TradeId} qty={Qty} price={Price}", trade.Id, fillQty, fillPrice);
    }
}
