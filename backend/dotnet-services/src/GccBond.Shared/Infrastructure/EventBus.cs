using System.Text;
using GccBond.Shared.Interfaces;
using Newtonsoft.Json;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using Serilog;

namespace GccBond.Shared.Infrastructure;

// ── Domain event envelope ─────────────────────────────────────────────────────

public record DomainEvent<T>
{
    public string   EventId       { get; init; } = Guid.NewGuid().ToString();
    public string   EventType     { get; init; } = "";
    public string   Source        { get; init; } = "dotnet";
    public T?       Payload       { get; init; }
    public string   CorrelationId { get; init; } = "";
    public DateTime Timestamp     { get; init; } = DateTime.UtcNow;
}

// ── Well-known routing keys ───────────────────────────────────────────────────

public static class Events
{
    public const string UserRegistered   = "user.registered";
    public const string KycApproved      = "kyc.approved";
    public const string KycRejected      = "kyc.rejected";
    public const string WalletFunded     = "wallet.funded";
    public const string TradeExecuted    = "trade.executed";
    public const string OrderFilled      = "order.filled";
    public const string OrderCancelled   = "order.cancelled";
    public const string OrderExpired     = "order.expired";
    public const string SettlementDone   = "settlement.completed";
    public const string SettlementFailed = "settlement.failed";
    public const string CouponPaid       = "coupon.paid";
    public const string AmlAlert         = "aml.alert";
}

// ── RabbitMQ event bus — implements shared IEventBus interface ────────────────

public class RabbitMqEventBus : IEventBus, IDisposable
{
    private readonly IConnection   _connection;
    private readonly IModel        _channel;
    private const string Exchange  = "gcc-bond";
    private const string DlxExchange = "gcc-bond-dlx";
    private readonly string        _serviceName;

    public RabbitMqEventBus(string amqpUrl, string serviceName)
    {
        _serviceName = serviceName;

        var factory = new ConnectionFactory
        {
            Uri              = new Uri(amqpUrl),
            DispatchConsumersAsync = true,
        };

        _connection = factory.CreateConnection();
        _channel    = _connection.CreateModel();

        // Main exchange (topic)
        _channel.ExchangeDeclare(Exchange, ExchangeType.Topic, durable: true);

        // Dead-letter exchange
        _channel.ExchangeDeclare(DlxExchange, ExchangeType.Topic, durable: true);
    }

    public Task PublishAsync<T>(string routingKey, T payload) where T : class
        => PublishAsync(routingKey, payload, "");

    public Task PublishAsync<T>(string routingKey, T payload, string correlationId = "") where T : class
    {
        var envelope = new DomainEvent<T>
        {
            EventType     = routingKey,
            Source        = _serviceName,
            Payload       = payload,
            CorrelationId = correlationId,
        };

        var body = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(envelope));

        var props = _channel.CreateBasicProperties();
        props.Persistent    = true;
        props.ContentType   = "application/json";
        props.CorrelationId = correlationId;

        _channel.BasicPublish(Exchange, routingKey, props, body);
        return Task.CompletedTask;
    }

    public Task SubscribeAsync<T>(string queue, string routingKey, Func<T, Task> handler) where T : class
        => SubscribeAsync<T>(queue, routingKey, (DomainEvent<T> e) => e.Payload is not null ? handler(e.Payload) : Task.CompletedTask);

    public Task SubscribeAsync<T>(string queue, string routingKey, Func<DomainEvent<T>, Task> handler)
    {
        var dlqName = $"{queue}-dlq";

        // Declare DLQ
        _channel.QueueDeclare(dlqName, durable: true, exclusive: false, autoDelete: false);
        _channel.QueueBind(dlqName, DlxExchange, routingKey);

        // Declare main queue with DLX
        var args = new Dictionary<string, object>
        {
            ["x-dead-letter-exchange"]    = DlxExchange,
            ["x-dead-letter-routing-key"] = routingKey,
        };
        _channel.QueueDeclare(queue, durable: true, exclusive: false, autoDelete: false, arguments: args);
        _channel.QueueBind(queue, Exchange, routingKey);

        _channel.BasicQos(0, 10, false); // prefetch 10

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.Received += async (_, ea) =>
        {
            var body = Encoding.UTF8.GetString(ea.Body.ToArray());
            try
            {
                var evt = JsonConvert.DeserializeObject<DomainEvent<T>>(body);
                if (evt is not null)
                    await handler(evt);

                _channel.BasicAck(ea.DeliveryTag, false);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Event handler failed for {Queue}", queue);
                _channel.BasicNack(ea.DeliveryTag, false, false); // send to DLQ
            }
        };

        _channel.BasicConsume(queue, autoAck: false, consumer);
        return Task.CompletedTask;
    }

    public void Close()
    {
        _channel?.Close();
        _connection?.Close();
    }

    public void Dispose() => Close();
}
