using GccBond.AML.Interfaces;
using GccBond.AML.Repositories;
using GccBond.AML.Services;
using GccBond.Shared.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GccBond.AML.Extensions;

public static class ServiceExtensions
{
    public static IServiceCollection AddAmlServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSharedInfrastructure(configuration);
        services.AddScoped<IAmlRepository, AmlRepository>();
        services.AddScoped<IAmlService, AmlService>();
        return services;
    }
}
