using GccBond.Settlement.Jobs;
using GccBond.Settlement.Services;
using GccBond.Shared.Infrastructure;
using Hangfire;
using Hangfire.PostgreSql;
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
    builder.Services.AddSingleton<IEventBus>(new RabbitMqEventBus(amqpUrl, "settlement"));
    builder.Services.AddScoped<SettlementService>();
    builder.Services.AddScoped<SettlementJob>();
    builder.Services.AddControllers();

    // Hangfire with PostgreSQL storage
    builder.Services.AddHangfire(c => c
        .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        .UsePostgreSqlStorage(o => o.UseNpgsqlConnection(connStr)));

    builder.Services.AddHangfireServer(o =>
    {
        o.Queues = ["default"];
        o.WorkerCount = 2;
    });

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
    app.UseHangfireDashboard("/hangfire", new DashboardOptions { IsReadOnlyFunc = _ => true });

    // Register recurring job: daily at 06:00 UTC
    RecurringJob.AddOrUpdate<SettlementJob>(
        "daily-settlement",
        j => j.RunAsync(),
        "0 6 * * *",
        new RecurringJobOptions { TimeZone = TimeZoneInfo.Utc });

    Log.Information("GccBond.Settlement starting");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Settlement service crashed");
}
finally
{
    Log.CloseAndFlush();
}
