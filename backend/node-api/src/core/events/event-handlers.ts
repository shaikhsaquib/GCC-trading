/**
 * Domain event consumers — subscribe once at startup.
 * Each handler is idempotent; errors are acked to DLQ by the event bus.
 */
import { v4 as uuidv4 } from 'uuid';
import { IEventBus } from './event-bus';
import {
  EventRoutes,
  KycApprovedPayload, KycRejectedPayload,
  WalletFundedPayload, TradeExecutedPayload,
  CouponPaidPayload, UserRegisteredPayload,
  SettlementDonePayload,
} from './event.types';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { WalletService }        from '../../modules/wallet/wallet.service';
import { WalletRepository }     from '../../modules/wallet/wallet.repository';
import { AuditService }         from '../../modules/audit/audit.service';
import { db }                   from '../database/postgres.client';
import { decrypt }              from '../crypto';
import { logger }               from '../logger';

async function getUserContact(userId: string) {
  const r = await db.query<{ email: string; phone: string; first_name: string }>(
    'SELECT email, phone, first_name FROM app_auth.users WHERE id = $1',
    [userId],
  );
  const row = r.rows[0];
  if (!row) return { email: '', phone: '', firstName: '' };
  return { email: decrypt(row.email), phone: decrypt(row.phone), firstName: row.first_name };
}

export async function registerEventHandlers(
  eventBus:   IEventBus,
  notifSvc:   NotificationsService,
  walletSvc:  WalletService,
  auditSvc:   AuditService,
  walletRepo: WalletRepository = new WalletRepository(),
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
        'SELECT preferred_currency FROM app_auth.users WHERE id = $1',
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

  // SETTLEMENT_DONE → write SETTLEMENT_DEBIT (buyer) + SETTLEMENT_CREDIT (seller) + notify both
  await eventBus.subscribe<SettlementDonePayload>(
    'node.settlement-done',
    EventRoutes.SETTLEMENT_DONE,
    async (event) => {
      const { trade_id, buyer_id, seller_id, bond_id, quantity, price, buyer_fee, seller_fee, currency } = event.payload;

      const tradeAmount = parseFloat(quantity) * parseFloat(price);
      const bFee        = parseFloat(buyer_fee);
      const sFee        = parseFloat(seller_fee);
      const sellerNet   = tradeAmount - sFee;

      const [buyerWallet, sellerWallet, bondRow] = await Promise.all([
        walletRepo.findByUserId(buyer_id),
        walletRepo.findByUserId(seller_id),
        db.query<{ name: string }>('SELECT name FROM bonds.listings WHERE id = $1', [bond_id]),
      ]);

      const bondName = bondRow.rows[0]?.name ?? 'Bond';

      await db.transaction(async (client) => {
        // Idempotency: skip if already settled (check for existing tx)
        const existing = await walletRepo.findTransactionByIdempotencyKey(`settle-buy-${trade_id}`);
        if (existing) return;

        if (buyerWallet) {
          await walletRepo.consumeFrozenForSettlement(buyer_id, tradeAmount, bFee, client);
          await walletRepo.insertTransaction({
            walletId:       buyerWallet.id,
            type:           'SETTLEMENT_DEBIT',
            amount:         tradeAmount + bFee,
            currency,
            status:         'COMPLETED',
            description:    `Bond Purchase settled — ${bondName}`,
            referenceId:    trade_id,
            idempotencyKey: `settle-buy-${trade_id}`,
          }, client);
        }

        if (sellerWallet) {
          await walletRepo.creditSettlement(seller_id, sellerNet, client);
          await walletRepo.insertTransaction({
            walletId:       sellerWallet.id,
            type:           'SETTLEMENT_CREDIT',
            amount:         sellerNet,
            currency,
            status:         'COMPLETED',
            description:    `Bond Sale settled — ${bondName}`,
            referenceId:    trade_id,
            idempotencyKey: `settle-sell-${trade_id}`,
          }, client);
        }
      });

      // Notify buyer
      if (buyerWallet) {
        const buyer = await getUserContact(buyer_id);
        await notifSvc.send({
          userId:    buyer_id,
          email:     buyer.email,
          eventType: 'SETTLEMENT_COMPLETE',
          channels:  ['email', 'push', 'in_app'],
          vars: {
            side:       'BUY',
            bond_name:  bondName,
            quantity,
            price,
            total:      (tradeAmount + bFee).toFixed(2),
            fee:        bFee.toFixed(2),
            currency,
            first_name: buyer.firstName,
          },
        });
      }

      // Notify seller
      if (sellerWallet) {
        const seller = await getUserContact(seller_id);
        await notifSvc.send({
          userId:    seller_id,
          email:     seller.email,
          eventType: 'SETTLEMENT_COMPLETE',
          channels:  ['email', 'push', 'in_app'],
          vars: {
            side:       'SELL',
            bond_name:  bondName,
            quantity,
            price,
            total:      sellerNet.toFixed(2),
            fee:        sFee.toFixed(2),
            currency,
            first_name: seller.firstName,
          },
        });
      }

      await auditSvc.log({
        event_type:     'SETTLEMENT_COMPLETED',
        action:         'settle',
        metadata:       event.payload as unknown as Record<string, unknown>,
        correlation_id: event.correlationId,
      });

      logger.info('Settlement processed', { trade_id, buyer_id, seller_id, tradeAmount, sellerNet });
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
