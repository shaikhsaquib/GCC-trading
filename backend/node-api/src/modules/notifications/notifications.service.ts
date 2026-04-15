import sgMail from '@sendgrid/mail';
import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../core/logger';
import { NotificationsRepository } from './notifications.repository';
import {
  SendNotificationDto, NotificationTemplate, NotificationEvent,
} from './notifications.types';

// ---------------------------------------------------------------------------
// Template registry (FSD §11)
// ---------------------------------------------------------------------------

const TEMPLATES: Record<NotificationEvent, NotificationTemplate> = {
  WELCOME: {
    subject:   'Welcome to GCC Bond Trading Platform',
    body:      'Hello {{first_name}}, welcome! Your account has been created. Complete KYC to start trading.',
    pushTitle: 'Welcome!',
    pushBody:  'Your GCC Bond account is ready.',
  },
  KYC_APPROVED: {
    subject:   'Your identity has been verified ✓',
    body:      'Hello {{first_name}}, your KYC has been approved. Risk level: {{risk_level}}. You can now trade.',
    smsBody:   'GCC Bond: KYC approved. You can now trade bonds.',
    pushTitle: 'KYC Approved',
    pushBody:  'Your identity has been verified. Start trading now!',
  },
  KYC_REJECTED: {
    subject:   'KYC Verification Unsuccessful',
    body:      'Hello {{first_name}}, your KYC was not approved. Reason: {{reason}}. You have {{remaining}} attempts remaining.',
    pushTitle: 'KYC Rejected',
    pushBody:  'Please resubmit your documents.',
  },
  DEPOSIT_SUCCESS: {
    subject:   'Deposit Confirmed — {{amount}} {{currency}}',
    body:      'Your deposit of {{amount}} {{currency}} was successful. New balance: {{balance}} {{currency}}. Transaction: {{tx_id}}.',
    smsBody:   'GCC Bond: {{amount}} {{currency}} deposited. Balance: {{balance}} {{currency}}.',
    pushTitle: 'Deposit Successful',
    pushBody:  '{{amount}} {{currency}} added to your wallet.',
  },
  WITHDRAWAL_INITIATED: {
    subject:   'Withdrawal Request Received',
    body:      'Your withdrawal of {{amount}} {{currency}} is being processed to {{bank_name}}.',
    pushTitle: 'Withdrawal Initiated',
    pushBody:  '{{amount}} {{currency}} withdrawal in progress.',
  },
  TRADE_EXECUTED: {
    subject:   'Trade Executed — {{side}} {{quantity}} units of {{bond_name}}',
    body:      '{{side}} order executed: {{quantity}} units of {{bond_name}} at {{price}} {{currency}}. Fee: {{fee}}. Total: {{total}} {{currency}}.',
    pushTitle: 'Trade Executed',
    pushBody:  '{{side}} {{quantity}} {{bond_name}} @ {{price}}',
  },
  COUPON_RECEIVED: {
    subject:   'Coupon Payment Received — {{amount}} {{currency}}',
    body:      'You received a coupon payment of {{amount}} {{currency}} from {{bond_name}}.',
    pushTitle: 'Coupon Received',
    pushBody:  '{{amount}} {{currency}} coupon from {{bond_name}}',
  },
  MATURITY_ALERT: {
    subject:   '{{bond_name}} matures in {{days_remaining}} days',
    body:      'Your bond {{bond_name}} (ISIN: {{isin}}) matures on {{maturity_date}}. Consider your options.',
    pushTitle: 'Bond Maturity Alert',
    pushBody:  '{{bond_name}} matures in {{days_remaining}} days.',
  },
  PASSWORD_CHANGED: {
    subject:   'Password Changed',
    body:      'Hello {{first_name}}, your password was changed. If this was not you, contact support immediately.',
    smsBody:   'GCC Bond: Your password was changed. Contact support if not you.',
    pushTitle: 'Password Changed',
    pushBody:  'Your account password was updated.',
  },
  ACCOUNT_SUSPENDED: {
    subject:   'Account Suspended',
    body:      'Your account has been suspended. Reason: {{reason}}. Contact support@gccbond.com.',
    pushTitle: 'Account Suspended',
    pushBody:  'Your account has been suspended.',
  },
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository) {
    if (config.sendgrid.apiKey) {
      sgMail.setApiKey(config.sendgrid.apiKey);
    }
  }

  async send(dto: SendNotificationDto): Promise<void> {
    const template = TEMPLATES[dto.eventType];
    if (!template) {
      logger.warn('Unknown notification event type', { eventType: dto.eventType });
      return;
    }

    const tasks: Promise<void>[] = [];

    if (dto.channels.includes('email') && dto.email) {
      tasks.push(this.sendEmail(dto.email, template, dto.vars));
    }
    if (dto.channels.includes('sms') && dto.phone && template.smsBody) {
      tasks.push(this.sendSms(dto.phone, interpolate(template.smsBody, dto.vars)));
    }
    if (dto.channels.includes('push') && dto.fcmToken && template.pushTitle) {
      tasks.push(this.sendPush(dto.fcmToken, template, dto.vars));
    }
    if (dto.channels.includes('in_app')) {
      tasks.push(
        this.repo.create({
          userId:    dto.userId,
          eventType: dto.eventType,
          channels:  dto.channels,
          vars:      dto.vars,
        }).then(() => void 0),
      );
    }

    const results = await Promise.allSettled(tasks);
    results.forEach((r) => {
      if (r.status === 'rejected') {
        logger.error('Notification delivery failed', { reason: r.reason, event: dto.eventType });
      }
    });
  }

  private async sendEmail(to: string, template: NotificationTemplate, vars: Record<string, string>): Promise<void> {
    if (!config.sendgrid.apiKey) return;

    await sgMail.send({
      to,
      from:    config.sendgrid.fromEmail,
      subject: interpolate(template.subject, vars),
      text:    interpolate(template.body, vars),
    });
  }

  private async sendSms(to: string, body: string): Promise<void> {
    if (!config.unifonic.apiKey) return;

    await axios.post('https://api.unifonic.com/rest/SMS/messages', {
      AppSid:      config.unifonic.apiKey,
      SenderID:    config.unifonic.senderId,
      Recipient:   to,
      Body:        body,
    });
  }

  private async sendPush(token: string, template: NotificationTemplate, vars: Record<string, string>): Promise<void> {
    if (!config.fcm.serverKey) return;

    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      {
        to:           token,
        notification: {
          title: interpolate(template.pushTitle ?? '', vars),
          body:  interpolate(template.pushBody  ?? '', vars),
        },
      },
      { headers: { Authorization: `key=${config.fcm.serverKey}` } },
    );
  }

  async getNotifications(userId: string, limit = 20, offset = 0) {
    return this.repo.findByUserId(userId, limit, offset);
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.repo.markRead(id, userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
  }
}
