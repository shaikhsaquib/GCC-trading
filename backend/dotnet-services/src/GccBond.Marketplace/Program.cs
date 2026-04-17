using GccBond.Marketplace.Extensions;
using GccBond.Marketplace.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    var jwtSecret = builder.Configuration["JWT_SECRET"]
                    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
                    ?? throw new InvalidOperationException("JWT_SECRET is not set");

    builder.Services.AddMarketplaceServices(builder.Configuration);
    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(o =>
        {
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(
                    System.Text.Encoding.UTF8.GetBytes(jwtSecret)),
                ValidateIssuer   = false,
                ValidateAudience = false,
            };
        });

    builder.Services.AddAuthorization();
    builder.Services.AddHealthChecks();

    var app = builder.Build();
    app.UseMiddleware<ExceptionMiddleware>();
    app.UseSerilogRequestLogging();
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHealthChecks("/health");

    Log.Information("GccBond.Marketplace starting");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Marketplace service crashed");
}
finally
{
    Log.CloseAndFlush();
}
