using GccBond.Settlement.Extensions;
using GccBond.Settlement.Jobs;
using GccBond.Settlement.Middleware;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

// Hangfire.PostgreSql requires Npgsql key-value format, not a URI.
// This converts "postgresql://user:pass@host:port/db" → "Host=host;Port=port;..."
static string ToNpgsqlKeyValue(string connStr)
{
    if (!connStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !connStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        return connStr; // Already in key-value format

    var uri      = new Uri(connStr);
    var userInfo = uri.UserInfo.Split(':', 2);
    var user     = Uri.UnescapeDataString(userInfo[0]);
    var pass     = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
    var host     = uri.Host;
    var port     = uri.Port > 0 ? uri.Port : 5432;
    var database = uri.AbsolutePath.TrimStart('/');

    // Parse any query params (e.g. ?sslmode=require)
    var query = uri.Query.TrimStart('?');
    var extra = string.IsNullOrEmpty(query) ? "" : ";" + query.Replace("=", "=").Replace("&", ";");

    return $"Host={host};Port={port};Database={database};Username={user};Password={pass};SSL Mode=Require;Trust Server Certificate=true{extra}";
}

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    var rawConnStr = builder.Configuration.GetConnectionString("Postgres")
                     ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                     ?? throw new InvalidOperationException("DATABASE_URL is not set");
    var connStr   = ToNpgsqlKeyValue(rawConnStr);
    var jwtSecret = builder.Configuration["JWT_SECRET"]
                    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
                    ?? throw new InvalidOperationException("JWT_SECRET is not set");

    builder.Services.AddSettlementServices(builder.Configuration);
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
    app.UseMiddleware<ExceptionMiddleware>();
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
