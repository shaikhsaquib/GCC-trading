using GccBond.Settlement.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.Settlement.Controllers;

[ApiController]
[Route("api/v1/settlement")]
[Authorize]
public class SettlementController : ControllerBase
{
    private readonly SettlementService _settlement;

    public SettlementController(SettlementService settlement) => _settlement = settlement;

    // GET /api/v1/settlement
    [HttpGet]
    [Authorize(Roles = "ADMIN,L2_ADMIN")]
    public async Task<IActionResult> GetSettlements(
        [FromQuery] string? status,
        [FromQuery] int     limit  = 50,
        [FromQuery] int     offset = 0)
    {
        var results = await _settlement.GetSettlementsAsync(status, limit, offset);
        return Ok(results);
    }

    // GET /api/v1/settlement/trade/:tradeId
    [HttpGet("trade/{tradeId:guid}")]
    public async Task<IActionResult> GetByTrade(Guid tradeId)
    {
        var settlement = await _settlement.GetSettlementByTradeAsync(tradeId);
        return settlement is null ? NotFound() : Ok(settlement);
    }

    // POST /api/v1/settlement/batch  (manual trigger — admin only)
    [HttpPost("batch")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> TriggerBatch()
    {
        _ = Task.Run(() => _settlement.RunDailyBatchAsync());
        return Accepted(new { message = "Settlement batch triggered" });
    }
}
