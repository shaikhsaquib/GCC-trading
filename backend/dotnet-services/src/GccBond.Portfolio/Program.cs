using GccBond.Portfolio.Services;
using GccBond.Shared.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;

Log.Logger = new LoggerConfiguration().WriteTo.Console().CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    var connStr   = Environment.GetEnvironmentVariable("DATABASE_URL")
                    ?? throw new InvalidOperationException("DATABASE_URL is not set");
    var amqpUrl   = Environment.GetEnvironmentVariable("RABBITMQ_URL") ?? "amqp://localhost";
    var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
                    ?? throw new InvalidOperationException("JWT_SECRET is not set");

    builder.Services.AddSingleton(new DatabaseHelper(connStr));
    builder.Services.AddSingleton<IEventBus>(new RabbitMqEventBus(amqpUrl, "portfolio"));
    builder.Services.AddScoped<PortfolioService>();
    builder.Services.AddControllers();

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(o =>
        {
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey         = new SymmetricSecurityKey(
                    System.Text.Encoding.UTF8.GetBytes(jwtSecret)),
                ValidateIssuer   = false,
                ValidateAudience = false,
            };
        });

    builder.Services.AddAuthorization();
    builder.Services.AddHealthChecks();

    var app = builder.Build();
    app.UseSerilogRequestLogging();
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHealthChecks("/health");

    Log.Information("GccBond.Portfolio starting");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Portfolio service crashed");
}
finally
{
    Log.CloseAndFlush();
}
