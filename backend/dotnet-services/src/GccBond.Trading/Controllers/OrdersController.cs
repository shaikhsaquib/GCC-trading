using GccBond.Shared.DTOs;
using GccBond.Trading.DTOs;
using GccBond.Trading.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.Trading.Controllers;

[ApiController]
[Route("api/v1/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly ITradingService _trading;

    public OrdersController(ITradingService trading) => _trading = trading;

    private Guid CurrentUserId => Guid.TryParse(
        User.FindFirst("sub")?.Value ?? User.FindFirst("userId")?.Value, out var id) ? id : Guid.Empty;

    // POST /api/v1/orders
    [HttpPost]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderRequest req)
    {
        var order = await _trading.PlaceOrderAsync(req with { UserId = CurrentUserId });
        return CreatedAtAction(nameof(GetOrder),
            new { id = order.Id },
            ApiResponse<OrderResponse>.Ok(OrderResponse.FromModel(order)));
    }

    // GET /api/v1/orders
    [HttpGet]
    public async Task<IActionResult> GetOrders(
        [FromQuery] string? status,
        [FromQuery] int     limit  = 20,
        [FromQuery] int     offset = 0)
    {
        var orders = await _trading.GetUserOrdersAsync(CurrentUserId, status, limit, offset);
        return Ok(ApiResponse<IEnumerable<OrderResponse>>.Ok(
            orders.Select(OrderResponse.FromModel)));
    }

    // GET /api/v1/orders/{id}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOrder(Guid id)
    {
        var order = await _trading.GetOrderAsync(id, CurrentUserId);
        if (order is null) return NotFound(ApiResponse<object>.Fail("Order not found"));
        return Ok(ApiResponse<OrderResponse>.Ok(OrderResponse.FromModel(order)));
    }

    // DELETE /api/v1/orders/{id}
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> CancelOrder(Guid id)
    {
        var order = await _trading.CancelOrderAsync(id, CurrentUserId);
        return Ok(ApiResponse<OrderResponse>.Ok(OrderResponse.FromModel(order)));
    }

    // GET /api/v1/orders/book/{bondId}?depth=20
    [HttpGet("book/{bondId:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetOrderBook(Guid bondId, [FromQuery] int depth = 20)
    {
        var book = await _trading.GetOrderBookAsync(bondId, depth);
        return Ok(ApiResponse<OrderBookResponse>.Ok(book));
    }
}
