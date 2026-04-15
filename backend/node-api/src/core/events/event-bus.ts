import amqplib, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { logger } from '../logger';
import { DomainEvent, EventRoute } from './event.types';

const EXCHANGE     = 'gcc-bond';
const DLX_EXCHANGE = 'gcc-bond-dlx';

// ---------------------------------------------------------------------------
// IEventBus interface — decouples services from the concrete implementation.
// ---------------------------------------------------------------------------

export interface IEventBus {
  publish<T>(routingKey: EventRoute | string, payload: T, correlationId?: string): Promise<void>;
  subscribe<T>(queue: string, routingKey: EventRoute | string, handler: (event: DomainEvent<T>) => Promise<void>): Promise<void>;
  connect(): Promise<void>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------
// RabbitMQ implementation
// ---------------------------------------------------------------------------

class RabbitMqEventBus implements IEventBus {
  private connection: Connection | null = null;
  private channel:    Channel    | null = null;

  async connect(): Promise<void> {
    this.connection = await amqplib.connect(config.rabbitmq.url);
    this.channel    = await this.connection.createChannel();

    await this.channel.assertExchange(EXCHANGE,     'topic', { durable: true });
    await this.channel.assertExchange(DLX_EXCHANGE, 'topic', { durable: true });

    this.connection.on('error', (err) => logger.error('RabbitMQ connection error', { error: err.message }));
    this.connection.on('close', () => logger.warn('RabbitMQ connection closed'));

    logger.info('RabbitMQ connected');
  }

  async publish<T>(routingKey: string, payload: T, correlationId = ''): Promise<void> {
    if (!this.channel) throw new Error('EventBus not connected');

    const envelope: DomainEvent<T> = {
      eventId:       uuidv4(),
      eventType:     routingKey,
      source:        'node-api',
      payload,
      correlationId: correlationId || uuidv4(),
      timestamp:     new Date().toISOString(),
    };

    const content = Buffer.from(JSON.stringify(envelope));

    this.channel.publish(EXCHANGE, routingKey, content, {
      persistent:    true,
      contentType:   'application/json',
      correlationId: envelope.correlationId,
    });
  }

  async subscribe<T>(
    queue: string,
    routingKey: string,
    handler: (event: DomainEvent<T>) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) throw new Error('EventBus not connected');

    const dlqName = `${queue}-dlq`;

    await this.channel.assertQueue(dlqName, { durable: true });
    await this.channel.bindQueue(dlqName, DLX_EXCHANGE, routingKey);

    await this.channel.assertQueue(queue, {
      durable:   true,
      arguments: {
        'x-dead-letter-exchange':    DLX_EXCHANGE,
        'x-dead-letter-routing-key': routingKey,
      },
    });
    await this.channel.bindQueue(queue, EXCHANGE, routingKey);
    await this.channel.prefetch(10);

    await this.channel.consume(queue, async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const event = JSON.parse(msg.content.toString()) as DomainEvent<T>;
        await handler(event);
        this.channel!.ack(msg);
      } catch (err) {
        logger.error('Event handler failed', { queue, routingKey, error: (err as Error).message });
        this.channel!.nack(msg, false, false); // send to DLQ
      }
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}

// Singleton
export const eventBus: IEventBus = new RabbitMqEventBus();
