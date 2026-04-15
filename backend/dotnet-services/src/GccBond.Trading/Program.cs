using GccBond.Shared.Infrastructure;
using GccBond.Trading.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;

// ── Bootstrap Serilog ─────────────────────────────────────────────────────────

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    // ── Configuration ─────────────────────────────────────────────────────────

    var connStr   = builder.Configuration.GetConnectionString("Postgres")
                    ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                    ?? throw new InvalidOperationException("DATABASE_URL is not set");
    var redisUrl  = builder.Configuration["Redis:Url"]
                    ?? Environment.GetEnvironmentVariable("REDIS_URL")
                    ?? "localhost:6379";
    var amqpUrl   = builder.Configuration["RabbitMQ:Url"]
                    ?? Environment.GetEnvironmentVariable("RABBITMQ_URL")
                    ?? "amqp://localhost";
    var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
                    ?? throw new InvalidOperationException("JWT_SECRET is not set");

    // ── Services ──────────────────────────────────────────────────────────────

    builder.Services.AddSingleton(new DatabaseHelper(connStr));
    builder.Services.AddSingleton(new RedisHelper(redisUrl));
    builder.Services.AddSingleton<IEventBus>(new RabbitMqEventBus(amqpUrl, "trading"));
    builder.Services.AddSingleton<MatchingEngine>();
    builder.Services.AddScoped<TradingService>();

    builder.Services.AddControllers();

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
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

    Log.Information("GccBond.Trading service starting on port {Port}", builder.Configuration["ASPNETCORE_URLS"] ?? "5001");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Trading service crashed on startup");
}
finally
{
    Log.CloseAndFlush();
}
