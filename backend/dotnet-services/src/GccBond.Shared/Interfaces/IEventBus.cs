namespace GccBond.Shared.Interfaces;

/// <summary>Domain event bus contract — implemented by RabbitMqEventBus.</summary>
public interface IEventBus
{
    Task PublishAsync<T>(string routingKey, T payload) where T : class;
    Task SubscribeAsync<T>(string queue, string routingKey, Func<T, Task> handler) where T : class;
    Task ConnectAsync();
    void Dispose();
}
