using GccBond.AML.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.AML.Controllers;

[ApiController]
[Route("api/v1/aml")]
[Authorize(Roles = "ADMIN,L2_ADMIN,COMPLIANCE")]
public class AmlController : ControllerBase
{
    private readonly AmlService _aml;

    public AmlController(AmlService aml) => _aml = aml;

    // GET /api/v1/aml/alerts
    [HttpGet("alerts")]
    public async Task<IActionResult> GetAlerts(
        [FromQuery] string? status,
        [FromQuery] int     limit  = 50,
        [FromQuery] int     offset = 0)
    {
        var alerts = await _aml.GetAlertsAsync(status, limit, offset);
        return Ok(alerts);
    }

    // PATCH /api/v1/aml/alerts/:id
    [HttpPatch("alerts/{id:guid}")]
    public async Task<IActionResult> UpdateAlert(Guid id, [FromBody] UpdateAlertRequest req)
    {
        if (!Enum.TryParse<AlertStatus>(req.Status, out var status))
            return BadRequest("Invalid status");

        await _aml.UpdateAlertStatusAsync(id, status, req.SarRef);
        return NoContent();
    }

    // POST /api/v1/aml/screen  (internal — called by Trading/Wallet services)
    [HttpPost("screen")]
    [AllowAnonymous] // secured via service-to-service secret header
    public async Task<IActionResult> Screen([FromBody] ScreenRequest req)
    {
        var serviceKey = Request.Headers["X-Service-Key"].FirstOrDefault();
        if (serviceKey != Environment.GetEnvironmentVariable("SERVICE_SECRET"))
            return Unauthorized();

        await _aml.ScreenTransactionAsync(
            req.UserId, req.Amount, req.Currency, req.TransactionId, req.Type);

        return Ok(new { screened = true });
    }
}

public record UpdateAlertRequest(string Status, string? SarRef);
public record ScreenRequest(Guid UserId, decimal Amount, string Currency, string TransactionId, string Type);
