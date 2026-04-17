using GccBond.Settlement.DTOs;
using GccBond.Settlement.Interfaces;
using GccBond.Shared.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.Settlement.Controllers;

[ApiController]
[Route("api/v1/settlement")]
[Authorize]
public class SettlementController : ControllerBase
{
    private readonly ISettlementService _settlement;

    public SettlementController(ISettlementService settlement) => _settlement = settlement;

    // GET /api/v1/settlement
    [HttpGet]
    [Authorize(Roles = "ADMIN,L2_ADMIN")]
    public async Task<IActionResult> GetSettlements(
        [FromQuery] string? status,
        [FromQuery] int     limit  = 50,
        [FromQuery] int     offset = 0)
    {
        var results = await _settlement.GetSettlementsAsync(status, limit, offset);
        return Ok(ApiResponse<IEnumerable<SettlementResponse>>.Ok(
            results.Select(SettlementResponse.FromModel)));
    }

    // GET /api/v1/settlement/trade/{tradeId}
    [HttpGet("trade/{tradeId:guid}")]
    public async Task<IActionResult> GetByTrade(Guid tradeId)
    {
        var settlement = await _settlement.GetByTradeIdAsync(tradeId);
        if (settlement is null) return NotFound(ApiResponse<object>.Fail("Settlement not found"));
        return Ok(ApiResponse<SettlementResponse>.Ok(SettlementResponse.FromModel(settlement)));
    }

    // POST /api/v1/settlement/batch  (admin — manual trigger)
    [HttpPost("batch")]
    [Authorize(Roles = "ADMIN")]
    public IActionResult TriggerBatch()
    {
        _ = Task.Run(() => _settlement.RunDailyBatchAsync());
        return Accepted(ApiResponse<object>.Ok(new { message = "Settlement batch triggered" }));
    }
}
