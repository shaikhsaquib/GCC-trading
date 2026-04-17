using GccBond.Portfolio.Interfaces;
using GccBond.Portfolio.Repositories;
using GccBond.Portfolio.Services;
using GccBond.Shared.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GccBond.Portfolio.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddPortfolioServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSharedInfrastructure(configuration);
        services.AddScoped<IPortfolioRepository, PortfolioRepository>();
        services.AddScoped<IPortfolioService, PortfolioService>();
        return services;
    }
}
