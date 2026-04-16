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
        var connStr      = configuration.GetConnectionString("Postgres")
                          ?? throw new InvalidOperationException("Connection string 'Postgres' is missing");
        var redisConn    = configuration.GetConnectionString("Redis")
                          ?? throw new InvalidOperationException("Connection string 'Redis' is missing");
        var rabbitMqUrl  = configuration["RabbitMQ:Url"]
                          ?? throw new InvalidOperationException("RabbitMQ:Url is missing");

        services.AddSingleton(_ => new DatabaseHelper(connStr));
        services.AddSingleton(_ => new RedisHelper(redisConn));
        services.AddSingleton<IEventBus>(_ => new RabbitMqEventBus(rabbitMqUrl));

        return services;
    }
}
