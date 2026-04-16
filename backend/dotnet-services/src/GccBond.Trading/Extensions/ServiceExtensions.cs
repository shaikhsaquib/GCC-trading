using FluentValidation;
using GccBond.Shared.Extensions;
using GccBond.Trading.Interfaces;
using GccBond.Trading.Repositories;
using GccBond.Trading.Services;
using GccBond.Trading.Validators;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GccBond.Trading.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddTradingServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Shared infrastructure (DB, Redis, RabbitMQ)
        services.AddSharedInfrastructure(configuration);

        // Repositories
        services.AddScoped<IOrderRepository, OrderRepository>();

        // Services
        services.AddScoped<IMatchingEngine, MatchingEngine>();
        services.AddScoped<ITradingService, TradingService>();

        // FluentValidation
        services.AddValidatorsFromAssemblyContaining<PlaceOrderRequestValidator>();

        return services;
    }
}
