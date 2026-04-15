using GccBond.Portfolio.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.Portfolio.Controllers;

[ApiController]
[Route("api/v1/portfolio")]
[Authorize]
public class PortfolioController : ControllerBase
{
    private readonly PortfolioService _portfolio;

    public PortfolioController(PortfolioService portfolio) => _portfolio = portfolio;

    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    // GET /api/v1/portfolio
    [HttpGet]
    public async Task<IActionResult> GetSummary()
    {
        var summary = await _portfolio.GetSummaryAsync(CurrentUserId);
        return Ok(summary);
    }

    // GET /api/v1/portfolio/holdings
    [HttpGet("holdings")]
    public async Task<IActionResult> GetHoldings()
    {
        var holdings = await _portfolio.GetRawHoldingsAsync(CurrentUserId);
        return Ok(holdings);
    }

    // GET /api/v1/portfolio/coupon-calendar
    [HttpGet("coupon-calendar")]
    public async Task<IActionResult> GetCouponCalendar()
    {
        var calendar = await _portfolio.GetCouponCalendarAsync(CurrentUserId);
        return Ok(calendar);
    }

    // POST /api/v1/portfolio/coupons/process  (admin)
    [HttpPost("coupons/process")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> ProcessCoupons()
    {
        _ = Task.Run(() => _portfolio.ProcessCouponPaymentsAsync());
        return Accepted(new { message = "Coupon processing triggered" });
    }
}
