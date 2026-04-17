using GccBond.Portfolio.DTOs;
using GccBond.Portfolio.Interfaces;
using GccBond.Shared.DTOs;
using GccBond.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.Portfolio.Controllers;

[ApiController]
[Route("api/v1/portfolio")]
[Authorize]
public class PortfolioController : ControllerBase
{
    private readonly IPortfolioService _portfolio;

    public PortfolioController(IPortfolioService portfolio) => _portfolio = portfolio;

    private Guid CurrentUserId => Guid.TryParse(
        User.FindFirst("sub")?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

    // GET /api/v1/portfolio
    [HttpGet]
    public async Task<IActionResult> GetSummary()
    {
        var summary = await _portfolio.GetSummaryAsync(CurrentUserId);
        return Ok(ApiResponse<PortfolioSummaryResponse>.Ok(summary));
    }

    // GET /api/v1/portfolio/holdings
    [HttpGet("holdings")]
    public async Task<IActionResult> GetHoldings()
    {
        var holdings = await _portfolio.GetHoldingsAsync(CurrentUserId);
        return Ok(ApiResponse<IEnumerable<PortfolioHolding>>.Ok(holdings));
    }

    // GET /api/v1/portfolio/coupon-calendar
    [HttpGet("coupon-calendar")]
    public async Task<IActionResult> GetCouponCalendar()
    {
        var calendar = await _portfolio.GetCouponCalendarAsync(CurrentUserId);
        return Ok(ApiResponse<IEnumerable<dynamic>>.Ok(calendar));
    }

    // POST /api/v1/portfolio/coupons/process  (admin)
    [HttpPost("coupons/process")]
    [Authorize(Roles = "ADMIN")]
    public IActionResult ProcessCoupons()
    {
        _ = Task.Run(() => _portfolio.ProcessCouponPaymentsAsync());
        return Accepted(ApiResponse<object>.Ok(new { message = "Coupon processing triggered" }));
    }
}
