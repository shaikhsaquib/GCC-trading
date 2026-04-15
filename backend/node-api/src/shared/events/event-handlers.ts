/**
 * Subscribe to domain events published by all modules (including .NET Core).
 * Each handler is idempotent — safe to run multiple times.
 */
import { eventBus, Events } from './event-bus';
import { walletService } from '../../modules/wallet/wallet.service';
import { notificationsService } from '../../modules/notifications/notifications.service';
import { auditService } from '../../modules/audit/audit.service';
import { db } from '../db/postgres';
import { decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import {
  UserRegisteredEvent, KycApprovedEvent, KycRejectedEvent,
  WalletFundedEvent, TradeExecutedEvent, CouponPaidEvent, Currency,
} from '../types';

async function getUserContact(userId: string): Promise<{ email: string; phone: string; first_name: string }> {
  const result = await db.query<{ email: string; phone: string; first_name: string }>(
    'SELECT email, phone, first_name FROM auth.users WHERE id = $1',
    [userId],
  );
  if (result.rows.length === 0) return { email: '', phone: '', first_name: '' };
  const { email, phone, first_name } = result.rows[0];
  return { email: decrypt(email), phone: decrypt(phone), first_name };
}

export const registerEventHandlers = async (): Promise<void> => {
  // ── USER REGISTERED → send welcome email ──────────────────────────────────
  await eventBus.subscribe<UserRegisteredEvent>(
    'node.user-registered',
    Events.USER_REGISTERED,
    async (event) => {
      const { user_id, email, first_name } = event.payload;

      await notificationsService.send({
        userId:    user_id,
        email,
        eventType: 'WELCOME',
        channels:  ['email', 'in_app'],
        vars:      { first_name },
      });

      await auditService.log({
        event_type:     'USER_REGISTERED',
        action:         'register',
        actor_id:       user_id,
        target_id:      user_id,
        target_type:    'USER',
        correlation_id: event.correlation_id,
      });
    },
  );

  // ── KYC APPROVED → create wallet + notify ─────────────────────────────────
  await eventBus.subscribe<KycApprovedEvent>(
    'node.kyc-approved',
    Events.KYC_APPROVED,
    async (event) => {
      const { user_id } = event.payload;
      const user = await getUserContact(user_id);

      // Determine currency from user's country
      const countryRow = await db.query<{ preferred_currency: string }>(
        'SELECT preferred_currency FROM auth.users WHERE id = $1',
        [user_id],
      );
      const currency = (countryRow.rows[0]?.preferred_currency ?? 'AED') as Currency;

      await walletService.createWallet(user_id, currency);

      await notificationsService.send({
        userId:    user_id,
        email:     user.email,
        phone:     user.phone,
        eventType: 'KYC_APPROVED',
        channels:  ['email', 'push', 'sms', 'in_app'],
        vars:      { first_name: user.first_name },
      });

      await auditService.log({
        event_type:  'KYC_APPROVED',
        action:      'approve',
        target_id:   user_id,
        target_type: 'KYC_SUBMISSION',
        metadata:    { kyc_id: event.payload.kyc_id, risk_level: event.payload.risk_level },
      });
    },
  );

  // ── KYC REJECTED → notify ─────────────────────────────────────────────────
  await eventBus.subscribe<KycRejectedEvent>(
    'node.kyc-rejected',
    Events.KYC_REJECTED,
    async (event) => {
      const { user_id, reason, remaining_attempts } = event.payload;
      const user = await getUserContact(user_id);

      await notificationsService.send({
        userId:    user_id,
        email:     user.email,
        eventType: 'KYC_REJECTED',
        channels:  ['email', 'push', 'in_app'],
        vars:      { first_name: user.first_name, reason, remaining: String(remaining_attempts) },
      });
    },
  );

  // ── WALLET FUNDED → notify ────────────────────────────────────────────────
  await eventBus.subscribe<WalletFundedEvent>(
    'node.wallet-funded',
    Events.WALLET_FUNDED,
    async (event) => {
      const { user_id, amount, currency } = event.payload;
      const user    = await getUserContact(user_id);
      const wallet  = await walletService.getBalance(user_id);

      await notificationsService.send({
        userId:    user_id,
        email:     user.email,
        eventType: 'DEPOSIT_SUCCESS',
        channels:  ['email', 'push', 'in_app'],
        vars: {
          amount:   parseFloat(amount).toLocaleString(),
          currency,
          balance:  wallet.balance.toLocaleString(),
          tx_id:    event.payload.transaction_id,
        },
      });
    },
  );

  // ── TRADE EXECUTED → notify buyer + seller ─────────────────────────────────
  await eventBus.subscribe<TradeExecutedEvent>(
    'node.trade-executed',
    Events.TRADE_EXECUTED,
    async (event) => {
      const { buyer_id, seller_id, bond_id, quantity, price, currency } = event.payload;

      const bondRow = await db.query<{ name: string }>(
        'SELECT name FROM bonds.listings WHERE id = $1',
        [bond_id],
      );
      const bondName = bondRow.rows[0]?.name ?? 'Unknown Bond';
      const tradeValue = (parseFloat(quantity) * parseFloat(price)).toFixed(2);
      const fee = (parseFloat(tradeValue) * 0.0025).toFixed(2);

      for (const [userId, side] of [[buyer_id, 'BUY'], [seller_id, 'SELL']] as const) {
        const user = await getUserContact(userId);
        await notificationsService.send({
          userId,
          email:     user.email,
          eventType: 'TRADE_EXECUTED',
          channels:  ['email', 'push', 'in_app'],
          vars: { side, quantity, bond_name: bondName, price, currency, fee, total: tradeValue },
        });
      }

      await auditService.log({
        event_type: 'TRADE_EXECUTED',
        action:     'trade',
        metadata:   event.payload as unknown as Record<string, unknown>,
        correlation_id: event.correlation_id,
      });
    },
  );

  // ── COUPON PAID → notify ──────────────────────────────────────────────────
  await eventBus.subscribe<CouponPaidEvent>(
    'node.coupon-paid',
    Events.COUPON_PAID,
    async (event) => {
      const { user_id, bond_id, amount, currency } = event.payload;
      const user    = await getUserContact(user_id);
      const bondRow = await db.query<{ name: string }>('SELECT name FROM bonds.listings WHERE id = $1', [bond_id]);

      await notificationsService.send({
        userId:    user_id,
        email:     user.email,
        eventType: 'COUPON_RECEIVED',
        channels:  ['email', 'push', 'in_app'],
        vars: { amount: parseFloat(amount).toLocaleString(), currency, bond_name: bondRow.rows[0]?.name ?? '' },
      });
    },
  );

  logger.info('Event handlers registered');
};
