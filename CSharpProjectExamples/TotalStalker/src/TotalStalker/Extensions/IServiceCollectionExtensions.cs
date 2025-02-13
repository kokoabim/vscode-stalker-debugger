namespace TotalStalker;

public static class IServiceCollectionExtensions
{
    public static IServiceCollection AddWebApp(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddLogging();
        services.AddOptions();

        return services;
    }
}
