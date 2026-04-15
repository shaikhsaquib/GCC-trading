using GccBond.Marketplace.Services;
using GccBond.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.Marketplace.Controllers;

[ApiController]
[Route("api/v1/bonds")]
public class BondsController : ControllerBase
{
    private readonly MarketplaceService _marketplace;

    public BondsController(MarketplaceService marketplace) => _marketplace = marketplace;

    // GET /api/v1/bonds
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> SearchBonds([FromQuery] BondSearchRequest req)
    {
        var (items, total) = await _marketplace.SearchBondsAsync(req);
        return Ok(new
        {
            data    = items,
            total,
            limit   = req.Limit,
            offset  = req.Offset,
        });
    }

    // GET /api/v1/bonds/:id
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBond(Guid id)
    {
        var detail = await _marketplace.GetBondDetailAsync(id);
        return detail is null ? NotFound() : Ok(detail);
    }

    // POST /api/v1/bonds  (admin only)
    [HttpPost]
    [Authorize(Roles = "ADMIN,L2_ADMIN")]
    public async Task<IActionResult> CreateBond([FromBody] BondListing bond)
    {
        var created = await _marketplace.CreateBondAsync(bond);
        return Created($"/api/v1/bonds/{created.Id}", created);
    }

    // PATCH /api/v1/bonds/:id/price  (admin only)
    [HttpPatch("{id:guid}/price")]
    [Authorize(Roles = "ADMIN,L2_ADMIN")]
    public async Task<IActionResult> UpdatePrice(Guid id, [FromBody] PriceUpdateRequest req)
    {
        await _marketplace.UpdateBondPriceAsync(id, req.Price);
        return NoContent();
    }
}

public record PriceUpdateRequest(decimal Price);
