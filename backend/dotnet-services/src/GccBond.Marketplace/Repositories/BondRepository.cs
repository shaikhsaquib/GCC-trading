using Dapper;
using GccBond.Marketplace.Interfaces;
using GccBond.Shared.Infrastructure;
using GccBond.Shared.Models;

namespace GccBond.Marketplace.Repositories;

public class BondRepository : IBondRepository
{
    private readonly DatabaseHelper _db;

    public BondRepository(DatabaseHelper db) => _db = db;

    public Task<BondListing?> GetByIdAsync(Guid id)
        => _db.QueryFirstOrDefaultAsync<BondListing>(
            "SELECT * FROM bonds.listings WHERE id = @Id", new { Id = id });

    public async Task<(IEnumerable<BondListing> Items, int Total)> SearchAsync(
        string? search, string? issuerType, bool? shariaCompliant,
        string? currency, string sortBy, string sortDir, int limit, int offset)
    {
        var conditions = new List<string> { "status = 'Active'" };
        var param      = new DynamicParameters();

        if (!string.IsNullOrWhiteSpace(search))
        {
            conditions.Add("(name ILIKE @Search OR isin ILIKE @Search OR issuer_name ILIKE @Search)");
            param.Add("Search", $"%{search}%");
        }
        if (!string.IsNullOrWhiteSpace(issuerType))
        {
            conditions.Add("issuer_type = @IssuerType");
            param.Add("IssuerType", issuerType);
        }
        if (shariaCompliant.HasValue)
        {
            conditions.Add("is_sharia_compliant = @Sharia");
            param.Add("Sharia", shariaCompliant.Value);
        }
        if (!string.IsNullOrWhiteSpace(currency))
        {
            conditions.Add("currency = @Currency");
            param.Add("Currency", currency);
        }

        var where   = string.Join(" AND ", conditions);
        var sortCol = sortBy switch
        {
            "name"          => "name",
            "current_price" => "current_price",
            "coupon_rate"   => "coupon_rate",
            "maturity_date" => "maturity_date",
            _               => "created_at",
        };
        var dir = sortDir.ToUpper() == "ASC" ? "ASC" : "DESC";

        param.Add("Limit",  limit);
        param.Add("Offset", offset);

        var items = await _db.QueryAsync<BondListing>(
            $"SELECT * FROM bonds.listings WHERE {where} ORDER BY {sortCol} {dir} LIMIT @Limit OFFSET @Offset",
            param);

        var total = await _db.ExecuteScalarAsync<int?>(
            $"SELECT COUNT(*) FROM bonds.listings WHERE {where}", param);

        return (items, total ?? 0);
    }

    public Task<IEnumerable<dynamic>> GetPriceHistoryAsync(Guid bondId, int days)
        => _db.QueryAsync<dynamic>(@"
            SELECT
                time_bucket('1 day', recorded_at) AS date,
                first(price, recorded_at)          AS open,
                MAX(price)                         AS high,
                MIN(price)                         AS low,
                last(price, recorded_at)           AS close
            FROM bonds.price_history
            WHERE bond_id = @BondId AND recorded_at >= NOW() - INTERVAL '1 day' * @Days
            GROUP BY 1 ORDER BY 1 DESC",
            new { BondId = bondId, Days = days });

    public async Task<Guid> CreateAsync(BondListing bond)
    {
        var id  = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await _db.ExecuteAsync(@"
            INSERT INTO bonds.listings
                (id, isin, name, issuer_name, issuer_type, currency, face_value,
                 coupon_rate, coupon_frequency, maturity_date, credit_rating,
                 is_sharia_compliant, min_investment, current_price, status, created_at, updated_at)
            VALUES
                (@Id, @Isin, @Name, @IssuerName, @IssuerType, @Currency, @FaceValue,
                 @CouponRate, @CouponFrequency, @MaturityDate, @CreditRating,
                 @IsShariaCompliant, @MinInvestment, @CurrentPrice, 'Active', @Now, @Now)",
            new
            {
                Id = id, bond.Isin, bond.Name, bond.IssuerName,
                IssuerType      = bond.IssuerType.ToString(),
                bond.Currency, bond.FaceValue, bond.CouponRate,
                CouponFrequency = bond.CouponFrequency.ToString(),
                bond.MaturityDate, bond.CreditRating,
                bond.IsShariaCompliant, bond.MinInvestment, bond.CurrentPrice,
                Now = now,
            });

        return id;
    }

    public Task UpdatePriceAsync(Guid bondId, decimal newPrice)
        => _db.TransactionAsync(async (conn, tx) =>
        {
            await conn.ExecuteAsync(
                "UPDATE bonds.listings SET current_price = @Price, updated_at = NOW() WHERE id = @Id",
                new { Id = bondId, Price = newPrice }, tx);

            await conn.ExecuteAsync(
                "INSERT INTO bonds.price_history (bond_id, price, recorded_at) VALUES (@BondId, @Price, NOW())",
                new { BondId = bondId, Price = newPrice }, tx);
        });

    public Task UpdateStatusAsync(Guid bondId, BondStatus status)
        => _db.ExecuteAsync(
            "UPDATE bonds.listings SET status = @Status, updated_at = NOW() WHERE id = @Id",
            new { Id = bondId, Status = status.ToString() });
}
