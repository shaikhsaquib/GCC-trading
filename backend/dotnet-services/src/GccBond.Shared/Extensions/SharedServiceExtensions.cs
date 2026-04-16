using GccBond.Shared.Infrastructure;
using GccBond.Shared.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GccBond.Shared.Extensions;

/// <summary>
/// Registers shared infrastructure services into the DI container.
/// Each service's Program.cs calls services.AddSharedInfrastructure(config).
/// </summary>
public static class SharedServiceExtensions
{
    public static IServiceCollection AddSharedInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // appsettings.json → environment variable fallback
        var connStr     = configuration.GetConnectionString("Postgres")
                          ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                          ?? throw new InvalidOperationException("DATABASE_URL / ConnectionStrings:Postgres is missing");

        var redisConn   = configuration.GetConnectionString("Redis")
                          ?? Environment.GetEnvironmentVariable("REDIS_URL")
                          ?? throw new InvalidOperationException("REDIS_URL / ConnectionStrings:Redis is missing");

        var rabbitMqUrl = configuration["RabbitMQ:Url"]
                          ?? Environment.GetEnvironmentVariable("RABBITMQ_URL")
                          ?? throw new InvalidOperationException("RABBITMQ_URL / RabbitMQ:Url is missing");

        var serviceName = configuration["ServiceName"]
                          ?? Environment.GetEnvironmentVariable("SERVICE_NAME")
                          ?? "gcc-bond-service";

        services.AddSingleton(_ => new DatabaseHelper(connStr));
        services.AddSingleton(_ => new RedisHelper(redisConn));
        services.AddSingleton<IEventBus>(_ => new RabbitMqEventBus(rabbitMqUrl, serviceName));

        return services;
    }
}
