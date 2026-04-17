using GccBond.AML.DTOs;
using GccBond.AML.Interfaces;
using GccBond.Shared.DTOs;
using GccBond.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.AML.Controllers;

[ApiController]
[Route("api/v1/aml")]
[Authorize(Roles = "ADMIN,L2_ADMIN,COMPLIANCE")]
public class AmlController : ControllerBase
{
    private readonly IAmlService _aml;
    private readonly string      _serviceSecret;

    public AmlController(IAmlService aml, IConfiguration config)
    {
        _aml           = aml;
        _serviceSecret = config["SERVICE_SECRET"]
                         ?? Environment.GetEnvironmentVariable("SERVICE_SECRET") ?? "";
    }

    // GET /api/v1/aml/alerts
    [HttpGet("alerts")]
    public async Task<IActionResult> GetAlerts(
        [FromQuery] string? status,
        [FromQuery] int     limit  = 50,
        [FromQuery] int     offset = 0)
    {
        var alerts = await _aml.GetAlertsAsync(status, limit, offset);
        return Ok(ApiResponse<IEnumerable<AmlAlertResponse>>.Ok(
            alerts.Select(AmlAlertResponse.FromModel)));
    }

    // PATCH /api/v1/aml/alerts/{id}
    [HttpPatch("alerts/{id:guid}")]
    public async Task<IActionResult> UpdateAlert(Guid id, [FromBody] UpdateAlertRequest req)
    {
        if (!Enum.TryParse<AlertStatus>(req.Status, true, out var status))
            return BadRequest(ApiResponse<object>.Fail("Invalid status value"));

        await _aml.UpdateAlertStatusAsync(id, status, req.SarRef);
        return NoContent();
    }

    // POST /api/v1/aml/screen  (internal — secured via X-Service-Key header)
    [HttpPost("screen")]
    [AllowAnonymous]
    public async Task<IActionResult> Screen([FromBody] ScreenRequest req)
    {
        var serviceKey = Request.Headers["X-Service-Key"].FirstOrDefault();
        if (string.IsNullOrEmpty(_serviceSecret) || serviceKey != _serviceSecret)
            return Unauthorized(ApiResponse<object>.Fail("Invalid service key"));

        await _aml.ScreenTransactionAsync(
            req.UserId, req.Amount, req.Currency, req.TransactionId, req.Type);

        return Ok(ApiResponse<object>.Ok(new { screened = true }));
    }
}
