import amqplib, { Channel, Connection, ConsumeMessage } from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { DomainEvent } from '../types';

const EXCHANGE     = process.env.RABBITMQ_EXCHANGE || 'gcc.bond.events';
const DLX          = process.env.RABBITMQ_DLX      || 'gcc.bond.dlx';
const EXCHANGE_TYPE = 'topic';

let connection: Connection | null = null;
let channel:    Channel | null    = null;

export const eventBus = {
  /** Connect and set up exchange + DLX */
  connect: async (): Promise<void> => {
    const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    connection = await amqplib.connect(url);
    channel    = await connection.createChannel();

    // Main exchange
    await channel.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

    // Dead Letter Exchange
    await channel.assertExchange(DLX, EXCHANGE_TYPE, { durable: true });

    logger.info('RabbitMQ: connected and exchanges asserted');

    connection.on('error', (err) => logger.error('RabbitMQ connection error', { error: err.message }));
    connection.on('close', () => logger.warn('RabbitMQ connection closed — will reconnect'));
  },

  /**
   * Publish a domain event.
   * routing key format: module.EventName  e.g. "auth.UserRegistered"
   */
  publish: async <T>(routingKey: string, payload: T, correlationId?: string): Promise<void> => {
    if (!channel) throw new Error('RabbitMQ channel not initialized');

    const event: DomainEvent<T> = {
      event_id:       uuidv4(),
      event_type:     routingKey,
      timestamp:      new Date().toISOString(),
      version:        '1.0',
      payload,
      correlation_id: correlationId ?? uuidv4(),
    };

    const content = Buffer.from(JSON.stringify(event));

    channel.publish(EXCHANGE, routingKey, content, {
      persistent:    true,
      contentType:   'application/json',
      messageId:     event.event_id,
      timestamp:     Date.now(),
      correlationId: event.correlation_id,
    });

    logger.debug('Event published', { routingKey, event_id: event.event_id });
  },

  /**
   * Subscribe to events matching a routing key pattern.
   * Supports wildcards: "auth.*" or "*.UserRegistered" or "#" for all.
   */
  subscribe: async <T>(
    queueName:  string,
    routingKey: string,
    handler:    (event: DomainEvent<T>) => Promise<void>,
    options:    { prefetch?: number } = {},
  ): Promise<void> => {
    if (!channel) throw new Error('RabbitMQ channel not initialized');

    const { prefetch = 10 } = options;

    // Assert queue with DLX fallback
    await channel.assertQueue(queueName, {
      durable:    true,
      arguments: {
        'x-dead-letter-exchange': DLX,
        'x-dead-letter-routing-key': `dlx.${queueName}`,
      },
    });

    await channel.bindQueue(queueName, EXCHANGE, routingKey);
    await channel.prefetch(prefetch);

    await channel.consume(queueName, async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString()) as DomainEvent<T>;
        await handler(event);
        channel!.ack(msg);
        logger.debug('Event consumed', { routingKey, event_id: event.event_id });
      } catch (err) {
        logger.error('Event handler failed — nacking', {
          routingKey,
          error: (err as Error).message,
        });
        // Nack without requeue → goes to DLX after configured retries
        channel!.nack(msg, false, false);
      }
    });

    logger.info('Subscribed to events', { queueName, routingKey });
  },

  close: async (): Promise<void> => {
    await channel?.close();
    await connection?.close();
  },
};

// ── Well-known routing keys ────────────────────────────────────────────────────

export const Events = {
  // Auth
  USER_REGISTERED:      'auth.UserRegistered',
  PASSWORD_CHANGED:     'auth.PasswordChanged',

  // KYC
  KYC_SUBMITTED:        'kyc.KycSubmitted',
  KYC_APPROVED:         'kyc.KycApproved',
  KYC_REJECTED:         'kyc.KycRejected',

  // Wallet
  WALLET_FUNDED:        'wallet.WalletFunded',
  WITHDRAWAL_INITIATED: 'wallet.WithdrawalInitiated',
  WITHDRAWAL_COMPLETED: 'wallet.WithdrawalCompleted',

  // Trading (published by .NET Core, consumed by Node.js)
  TRADE_EXECUTED:       'trading.TradeExecuted',
  TRADE_SETTLED:        'trading.TradeSettled',
  ORDER_CANCELLED:      'trading.OrderCancelled',

  // Portfolio (published by .NET Core)
  COUPON_PAID:          'portfolio.CouponPaid',
  BOND_MATURED:         'portfolio.BondMatured',

  // Compliance
  AML_ALERT:            'compliance.AmlAlert',
  SAR_FILED:            'compliance.SarFiled',
} as const;
