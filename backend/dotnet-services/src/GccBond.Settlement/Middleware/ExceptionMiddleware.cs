using GccBond.Shared.DTOs;
using GccBond.Shared.Exceptions;
using Serilog;

namespace GccBond.Settlement.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    public ExceptionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        try { await _next(context); }
        catch (DomainException ex)
        {
            Log.Warning("Domain exception: {Code} — {Message}", ex.Code, ex.Message);
            context.Response.StatusCode  = ex.StatusCode;
            context.Response.ContentType = "application/json";
            var errors = ex is ValidationException ve ? string.Join("; ", ve.Errors) : ex.Message;
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(errors));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unhandled exception");
            context.Response.StatusCode  = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("An unexpected error occurred"));
        }
    }
}
