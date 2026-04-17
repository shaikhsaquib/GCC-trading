using FluentValidation;
using GccBond.Marketplace.Interfaces;
using GccBond.Marketplace.Repositories;
using GccBond.Marketplace.Services;
using GccBond.Marketplace.Validators;
using GccBond.Shared.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GccBond.Marketplace.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddMarketplaceServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSharedInfrastructure(configuration);
        services.AddScoped<IBondRepository, BondRepository>();
        services.AddScoped<IMarketplaceService, MarketplaceService>();
        services.AddValidatorsFromAssemblyContaining<CreateBondRequestValidator>();
        return services;
    }
}
