using GccBond.Settlement.Interfaces;
using GccBond.Settlement.Repositories;
using GccBond.Settlement.Services;
using GccBond.Shared.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GccBond.Settlement.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddSettlementServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSharedInfrastructure(configuration);
        services.AddScoped<ISettlementRepository, SettlementRepository>();
        services.AddScoped<ISettlementService, SettlementService>();
        return services;
    }
}
