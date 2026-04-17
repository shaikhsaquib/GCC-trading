using GccBond.Marketplace.DTOs;
using GccBond.Marketplace.Interfaces;
using GccBond.Shared.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.Marketplace.Controllers;

[ApiController]
[Route("api/v1/bonds")]
public class BondsController : ControllerBase
{
    private readonly IMarketplaceService _marketplace;

    public BondsController(IMarketplaceService marketplace) => _marketplace = marketplace;

    // GET /api/v1/bonds
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> SearchBonds([FromQuery] BondSearchRequest req)
    {
        var result = await _marketplace.SearchBondsAsync(req);
        return Ok(ApiResponse<PagedBondResponse>.Ok(result));
    }

    // GET /api/v1/bonds/{id}
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBond(Guid id)
    {
        var detail = await _marketplace.GetBondDetailAsync(id);
        if (detail is null) return NotFound(ApiResponse<object>.Fail("Bond not found"));
        return Ok(ApiResponse<BondDetailResponse>.Ok(detail));
    }

    // POST /api/v1/bonds  (admin only)
    [HttpPost]
    [Authorize(Roles = "ADMIN,L2_ADMIN")]
    public async Task<IActionResult> CreateBond([FromBody] CreateBondRequest req)
    {
        var bond = await _marketplace.CreateBondAsync(req);
        return CreatedAtAction(nameof(GetBond),
            new { id = bond.Id },
            ApiResponse<BondResponse>.Ok(bond));
    }

    // PATCH /api/v1/bonds/{id}/price  (admin only)
    [HttpPatch("{id:guid}/price")]
    [Authorize(Roles = "ADMIN,L2_ADMIN")]
    public async Task<IActionResult> UpdatePrice(Guid id, [FromBody] UpdatePriceRequest req)
    {
        await _marketplace.UpdateBondPriceAsync(id, req.Price);
        return NoContent();
    }
}

public record UpdatePriceRequest(decimal Price);
