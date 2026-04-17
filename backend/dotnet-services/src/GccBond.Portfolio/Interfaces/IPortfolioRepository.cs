using GccBond.Shared.Models;

namespace GccBond.Portfolio.Interfaces;

public interface IPortfolioRepository
{
    Task<IEnumerable<dynamic>> GetHoldingDetailsAsync(Guid userId);
    Task<IEnumerable<PortfolioHolding>> GetRawHoldingsAsync(Guid userId);
    Task<IEnumerable<dynamic>> GetCouponCalendarAsync(Guid userId);
    Task<IEnumerable<dynamic>> GetDueCouponsAsync(DateTime date);
    Task<IEnumerable<dynamic>> GetHoldersByBondAsync(Guid bondId);
    Task ProcessCouponPaymentAsync(Guid userId, Guid bondId, decimal amount, string currency, string bondName);
    Task MarkCouponPaidAsync(Guid bondId, DateTime paymentDate);
}
