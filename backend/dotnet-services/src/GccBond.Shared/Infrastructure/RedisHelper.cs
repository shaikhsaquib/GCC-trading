using Newtonsoft.Json;
using StackExchange.Redis;

namespace GccBond.Shared.Infrastructure;

/// <summary>
/// Typed Redis helpers wrapping StackExchange.Redis.
/// Used by Trading (order book) and other .NET services.
/// </summary>
public class RedisHelper
{
    private readonly IDatabase _db;
    private readonly IConnectionMultiplexer _mux;

    public RedisHelper(string redisUrl)
    {
        _mux = ConnectionMultiplexer.Connect(redisUrl);
        _db  = _mux.GetDatabase();
    }

    // ── Key/Value ──────────────────────────────────────────────────────────────

    public Task SetAsync(string key, string value, TimeSpan? ttl = null)
        => _db.StringSetAsync(key, value, ttl);

    public async Task<string?> GetAsync(string key)
        => await _db.StringGetAsync(key);

    public Task<bool> DeleteAsync(string key)
        => _db.KeyDeleteAsync(key);

    public Task<bool> ExistsAsync(string key)
        => _db.KeyExistsAsync(key);

    public async Task SetJsonAsync<T>(string key, T value, TimeSpan? ttl = null)
        => await SetAsync(key, JsonConvert.SerializeObject(value), ttl);

    public async Task<T?> GetJsonAsync<T>(string key)
    {
        var raw = await GetAsync(key);
        return raw is null ? default : JsonConvert.DeserializeObject<T>(raw);
    }

    // ── Order Book (Sorted Sets) ───────────────────────────────────────────────
    // Key pattern: order-book:{bondId}:buy   (score = -price for max-heap)
    //              order-book:{bondId}:sell  (score = price for min-heap)

    public Task OrderBookAddAsync(string key, string orderId, double score)
        => _db.SortedSetAddAsync(key, orderId, score);

    public Task OrderBookRemoveAsync(string key, string orderId)
        => _db.SortedSetRemoveAsync(key, orderId);

    /// <summary>Returns best buy orders (highest price first — scores are negated).</summary>
    public async Task<string[]> GetBestBuyOrders(string bondId, int count = 20)
    {
        var entries = await _db.SortedSetRangeByRankAsync(
            $"order-book:{bondId}:buy", 0, count - 1, Order.Ascending);
        return entries.Select(e => (string)e!).ToArray();
    }

    /// <summary>Returns best sell orders (lowest price first).</summary>
    public async Task<string[]> GetBestSellOrders(string bondId, int count = 20)
    {
        var entries = await _db.SortedSetRangeByRankAsync(
            $"order-book:{bondId}:sell", 0, count - 1, Order.Ascending);
        return entries.Select(e => (string)e!).ToArray();
    }

    public async Task<SortedSetEntry[]> GetOrderBookEntries(string bondId, string side, int count = 50)
    {
        var key = $"order-book:{bondId}:{side.ToLower()}";
        return await _db.SortedSetRangeByRankWithScoresAsync(key, 0, count - 1, Order.Ascending);
    }

    // ── Distributed Lock (for matching engine) ────────────────────────────────

    public async Task<bool> AcquireLockAsync(string resource, string lockId, TimeSpan ttl)
    {
        var key = $"lock:{resource}";
        return await _db.StringSetAsync(key, lockId, ttl, When.NotExists);
    }

    public async Task ReleaseLockAsync(string resource, string lockId)
    {
        var key = $"lock:{resource}";
        var current = await _db.StringGetAsync(key);
        if (current == lockId)
            await _db.KeyDeleteAsync(key);
    }

    // ── Feature Flags ─────────────────────────────────────────────────────────

    public async Task<bool> GetFeatureFlagAsync(string flag)
    {
        var val = await _db.StringGetAsync($"feature:{flag}");
        return val == "true";
    }

    public bool IsConnected => _mux.IsConnected;
}
