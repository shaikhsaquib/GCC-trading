using GccBond.Shared.Models;
using GccBond.Trading.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GccBond.Trading.Controllers;

[ApiController]
[Route("api/v1/orders")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly TradingService _trading;

    public OrdersController(TradingService trading) => _trading = trading;

    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    // POST /api/v1/orders
    [HttpPost]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderRequest req)
    {
        var order = await _trading.PlaceOrderAsync(req with { UserId = CurrentUserId });
        return Created($"/api/v1/orders/{order.Id}", order);
    }

    // GET /api/v1/orders
    [HttpGet]
    public async Task<IActionResult> GetOrders(
        [FromQuery] string? status,
        [FromQuery] int     limit  = 50,
        [FromQuery] int     offset = 0)
    {
        var orders = await _trading.GetUserOrdersAsync(CurrentUserId, status, limit, offset);
        return Ok(orders);
    }

    // GET /api/v1/orders/:id
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOrder(Guid id)
    {
        var order = await _trading.GetOrderAsync(id, CurrentUserId);
        return order is null ? NotFound() : Ok(order);
    }

    // DELETE /api/v1/orders/:id  (cancel)
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> CancelOrder(Guid id)
    {
        var order = await _trading.CancelOrderAsync(id, CurrentUserId);
        return Ok(order);
    }

    // GET /api/v1/orders/book/:bondId
    [HttpGet("book/{bondId:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetOrderBook(Guid bondId, [FromQuery] int depth = 20)
    {
        var book = await _trading.GetOrderBookAsync(bondId, depth);
        return Ok(book);
    }
}
