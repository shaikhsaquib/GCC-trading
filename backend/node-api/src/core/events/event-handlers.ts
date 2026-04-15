/**
 * Domain event consumers — subscribe once at startup.
 * Each handler is idempotent; errors are acked to DLQ by the event bus.
 */
import { IEventBus } from './event-bus';
import {
  EventRoutes,
  KycApprovedPayload, KycRejectedPayload,
  WalletFundedPayload, TradeExecutedPayload,
  CouponPaidPayload, UserRegisteredPayload,
} from './event.types';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { WalletService }        from '../../modules/wallet/wallet.service';
import { AuditService }         from '../../modules/audit/audit.service';
import { db }                   from '../database/postgres.client';
import { decrypt }              from '../crypto';
import { logger }               from '../logger';

async function getUserContact(userId: string) {
  const r = await db.query<{ email: string; phone: string; first_name: string }>(
    'SELECT email, phone, first_name FROM auth.users WHERE id = $1',
    [userId],
  );
  const row = r.rows[0];
  if (!row) return { email: '', phone: '', firstName: '' };
  return { email: decrypt(row.email), phone: decrypt(row.phone), firstName: row.first_name };
}

export async function registerEventHandlers(
  eventBus:  IEventBus,
  notifSvc:  NotificationsService,
  walletSvc: WalletService,
  auditSvc:  AuditService,
): Promise<void> {

  // USER_REGISTERED → welcome email + audit
  await eventBus.subscribe<UserRegisteredPayload>(
    'node.user-registered',
    EventRoutes.USER_REGISTERED,
    async (event) => {
      await notifSvc.send({
        userId:    event.payload.user_id,
        email:     event.payload.email,
        eventType: 'WELCOME',
        channels:  ['email', 'in_app'],
        vars:      { first_name: event.payload.first_name },
      });

      await auditSvc.log({
        event_type:     'USER_REGISTERED',
        action:         'register',
        actor_id:       event.payload.user_id,
        target_id:      event.payload.user_id,
        target_type:    'USER',
        correlation_id: event.correlationId,
      });
    },
  );

  // KYC_APPROVED → create wallet + notify all channels + audit
  await eventBus.subscribe<KycApprovedPayload>(
    'node.kyc-approved',
    EventRoutes.KYC_APPROVED,
    async (event) => {
      const { user_id, risk_level } = event.payload;
      const user = await getUserContact(user_id);

      const currencyRow = await db.query<{ preferred_currency: string }>(
        'SELECT preferred_currency FROM auth.users WHERE id = $1',
        [user_id],
      );
      const currency = (currencyRow.rows[0]?.preferred_currency ?? 'AED') as any;

      await walletSvc.createWallet(user_id, currency);

      await notifSvc.send({
        userId:    user_id,
        email:     user.email,
        phone:     user.phone,
        eventType: 'KYC_APPROVED',
        channels:  ['email', 'push', 'sms', 'in_app'],
        vars:      { first_name: user.firstName, risk_level },
      });

      await auditSvc.log({
        event_type:  'KYC_APPROVED',
        action:      'approve',
        actor_id:    user_id,
        target_id:   event.payload.kyc_id,
        target_type: 'KYC_SUBMISSION',
        metadata:    { risk_level },
      });
    },
  );

  // KYC_REJECTED → notify with remaining attempts
  await eventBus.subscribe<KycRejectedPayload>(
    'node.kyc-rejected',
    EventRoutes.KYC_REJECTED,
    async (event) => {
      const { user_id, reason, remaining_attempts } = event.payload;
      const user = await getUserContact(user_id);

      await notifSvc.send({
        userId:    user_id,
        email:     user.email,
        eventType: 'KYC_REJECTED',
        channels:  ['email', 'in_app'],
        vars:      { first_name: user.firstName, reason, remaining: String(remaining_attempts) },
      });
    },
  );

  // WALLET_FUNDED → deposit confirmation
  await eventBus.subscribe<WalletFundedPayload>(
    'node.wallet-funded',
    EventRoutes.WALLET_FUNDED,
    async (event) => {
      const { user_id, amount, currency, transaction_id } = event.payload;
      const user    = await getUserContact(user_id);
      const balance = await walletSvc.getBalance(user_id);

      await notifSvc.send({
        userId:    user_id,
        email:     user.email,
        eventType: 'DEPOSIT_SUCCESS',
        channels:  ['email', 'push', 'in_app'],
        vars: {
          amount,
          currency,
          balance:  balance.availableBalance.toLocaleString(),
          tx_id:    transaction_id,
          first_name: user.firstName,
        },
      });
    },
  );

  // TRADE_EXECUTED → notify buyer + seller
  await eventBus.subscribe<TradeExecutedPayload>(
    'node.trade-executed',
    EventRoutes.TRADE_EXECUTED,
    async (event) => {
      const { buyer_id, seller_id, bond_id, quantity, price, buyer_fee, currency } = event.payload;

      const bondRow = await db.query<{ name: string }>(
        'SELECT name FROM bonds.listings WHERE id = $1',
        [bond_id],
      );
      const bondName   = bondRow.rows[0]?.name ?? 'Unknown Bond';
      const tradeValue = (parseFloat(quantity) * parseFloat(price)).toFixed(2);

      for (const [userId, side, fee] of [
        [buyer_id,  'BUY',  buyer_fee],
        [seller_id, 'SELL', event.payload.seller_fee],
      ] as const) {
        const user = await getUserContact(userId);
        await notifSvc.send({
          userId,
          email:     user.email,
          eventType: 'TRADE_EXECUTED',
          channels:  ['email', 'push', 'in_app'],
          vars:      { side, quantity, bond_name: bondName, price, currency, fee, total: tradeValue, first_name: user.firstName },
        });
      }

      await auditSvc.log({
        event_type:     'TRADE_EXECUTED',
        action:         'trade',
        metadata:       event.payload as unknown as Record<string, unknown>,
        correlation_id: event.correlationId,
      });
    },
  );

  // COUPON_PAID → coupon received notification
  await eventBus.subscribe<CouponPaidPayload>(
    'node.coupon-paid',
    EventRoutes.COUPON_PAID,
    async (event) => {
      const { user_id, bond_id, amount, currency } = event.payload;
      const user    = await getUserContact(user_id);
      const bondRow = await db.query<{ name: string }>(
        'SELECT name FROM bonds.listings WHERE id = $1',
        [bond_id],
      );

      await notifSvc.send({
        userId:    user_id,
        email:     user.email,
        eventType: 'COUPON_RECEIVED',
        channels:  ['email', 'push', 'in_app'],
        vars: {
          amount: parseFloat(amount).toLocaleString(),
          currency,
          bond_name:  bondRow.rows[0]?.name ?? '',
          first_name: user.firstName,
        },
      });
    },
  );

  logger.info('Event handlers registered');
}
