using GccBond.Marketplace.DTOs;

namespace GccBond.Marketplace.Interfaces;

public interface IMarketplaceService
{
    Task<PagedBondResponse> SearchBondsAsync(BondSearchRequest request);
    Task<BondDetailResponse?> GetBondDetailAsync(Guid bondId);
    Task<BondResponse> CreateBondAsync(CreateBondRequest request);
    Task UpdateBondPriceAsync(Guid bondId, decimal newPrice);
}
