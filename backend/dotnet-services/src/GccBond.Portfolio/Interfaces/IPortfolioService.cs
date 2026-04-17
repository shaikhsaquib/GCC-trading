using GccBond.Portfolio.DTOs;
using GccBond.Shared.Models;

namespace GccBond.Portfolio.Interfaces;

public interface IPortfolioService
{
    Task<PortfolioSummaryResponse> GetSummaryAsync(Guid userId);
    Task<IEnumerable<PortfolioHolding>> GetHoldingsAsync(Guid userId);
    Task<IEnumerable<dynamic>> GetCouponCalendarAsync(Guid userId);
    Task ProcessCouponPaymentsAsync();
}
