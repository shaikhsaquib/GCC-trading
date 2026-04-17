using GccBond.Shared.Models;

namespace GccBond.Marketplace.Interfaces;

public interface IBondRepository
{
    Task<BondListing?> GetByIdAsync(Guid id);
    Task<(IEnumerable<BondListing> Items, int Total)> SearchAsync(
        string? search, string? issuerType, bool? shariaCompliant,
        string? currency, string sortBy, string sortDir, int limit, int offset);
    Task<IEnumerable<dynamic>> GetPriceHistoryAsync(Guid bondId, int days);
    Task<Guid> CreateAsync(BondListing bond);
    Task UpdatePriceAsync(Guid bondId, decimal newPrice);
    Task UpdateStatusAsync(Guid bondId, BondStatus status);
}
