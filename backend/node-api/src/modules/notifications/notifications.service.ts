import sgMail from '@sendgrid/mail';
import axios from 'axios';
import { NotificationLog } from '../../shared/db/mongodb';
import { logger } from '../../shared/utils/logger';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

// ── Notification Templates (FSD §11) ──────────────────────────────────────────

const templates: Record<string, { subject: string; body: (vars: Record<string, string>) => string }> = {
  WELCOME: {
    subject: 'Welcome to GCC Bond Trading!',
    body: ({ first_name }) =>
      `Hi ${first_name}, your account has been created. Complete your identity verification to start trading.`,
  },
  KYC_APPROVED: {
    subject: 'Identity Verified ✓',
    body: ({ first_name }) =>
      `Hi ${first_name}, your identity has been verified. You can now deposit funds and start trading bonds.`,
  },
  KYC_REJECTED: {
    subject: 'Verification Update',
    body: ({ first_name, reason, remaining }) =>
      `Hi ${first_name}, your identity verification was not approved. Reason: ${reason}. You can re-submit up to ${remaining} more times.`,
  },
  DEPOSIT_SUCCESS: {
    subject: 'Deposit Confirmed',
    body: ({ amount, currency, balance }) =>
      `Your deposit of ${amount} ${currency} has been credited to your wallet. New balance: ${balance}.`,
  },
  WITHDRAWAL_INITIATED: {
    subject: 'Withdrawal Processing',
    body: ({ amount, currency, last4 }) =>
      `Your withdrawal of ${amount} ${currency} to bank account ending ${last4} is being processed. Expected: 1-3 business days.`,
  },
  TRADE_EXECUTED: {
    subject: 'Trade Confirmed ✓',
    body: ({ side, quantity, bond_name, price, currency, fee, total }) =>
      `Your ${side} order for ${quantity} units of ${bond_name} was executed at ${price} ${currency}. Fee: ${fee}. Total: ${total}.`,
  },
  COUPON_RECEIVED: {
    subject: 'Coupon Payment Received',
    body: ({ amount, currency, bond_name }) =>
      `You received a coupon payment of ${amount} ${currency} from ${bond_name}. Credited to your wallet.`,
  },
  MATURITY_ALERT: {
    subject: 'Bond Maturing Soon',
    body: ({ bond_name, date, face_value, currency }) =>
      `${bond_name} matures on ${date}. Face value ${face_value} ${currency} will be credited to your wallet.`,
  },
  PASSWORD_CHANGED: {
    subject: 'Password Updated — Security Alert',
    body: ({ date, time }) =>
      `Your password was changed on ${date} at ${time}. If this wasn't you, contact support immediately.`,
  },
  ACCOUNT_SUSPENDED: {
    subject: 'Account Suspended',
    body: ({ first_name }) =>
      `Hi ${first_name}, your account has been temporarily suspended. Contact support for more information.`,
  },
};

// ── Send helpers ───────────────────────────────────────────────────────────────

async function sendEmail(
  toEmail: string,
  eventType: string,
  vars: Record<string, string>,
): Promise<void> {
  const tpl = templates[eventType];
  if (!tpl) { logger.warn('No email template for event', { eventType }); return; }

  try {
    await sgMail.send({
      to:      toEmail,
      from:    { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@gccbond.com', name: 'GCC Bond Trading' },
      subject: tpl.subject,
      text:    tpl.body(vars),
    });
    logger.info('Email sent', { to: toEmail, event: eventType });
  } catch (err) {
    logger.error('SendGrid error', { error: (err as Error).message, event: eventType });
  }
}

async function sendSMS(phone: string, message: string): Promise<void> {
  try {
    await axios.post(
      `${process.env.UNIFONIC_BASE_URL}/messages`,
      { AppSid: process.env.UNIFONIC_APP_SID, Recipient: phone, Body: message },
      { timeout: 10_000 },
    );
    logger.info('SMS sent', { phone: phone.slice(0, 6) + '****' });
  } catch (err) {
    logger.error('Unifonic SMS error', { error: (err as Error).message });
  }
}

async function sendPush(fcmToken: string, title: string, body: string): Promise<void> {
  if (!fcmToken) return;
  try {
    await axios.post(
      'https://fcm.googleapis.com/fcm/send',
      { to: fcmToken, notification: { title, body } },
      { headers: { Authorization: `key=${process.env.FCM_SERVER_KEY}` }, timeout: 10_000 },
    );
    logger.info('Push sent', { event: title });
  } catch (err) {
    logger.error('FCM push error', { error: (err as Error).message });
  }
}

// ── Notification Service ──────────────────────────────────────────────────────

export const notificationsService = {
  send: async (params: {
    userId: string;
    email?: string;
    phone?: string;
    fcmToken?: string;
    eventType: string;
    channels: Array<'email' | 'sms' | 'push' | 'in_app'>;
    vars: Record<string, string>;
  }) => {
    const { userId, email, phone, fcmToken, eventType, channels, vars } = params;
    const tpl = templates[eventType];
    if (!tpl) return;

    const title   = tpl.subject;
    const message = tpl.body(vars);

    const tasks: Promise<void>[] = [];

    if (channels.includes('email') && email) tasks.push(sendEmail(email, eventType, vars));
    if (channels.includes('sms')   && phone) tasks.push(sendSMS(phone, message));
    if (channels.includes('push')  && fcmToken) tasks.push(sendPush(fcmToken, title, message));

    await Promise.allSettled(tasks);

    // Persist in_app notification to MongoDB
    if (channels.includes('in_app') || channels.includes('email')) {
      await NotificationLog.create({
        user_id:    userId,
        channel:    'in_app',
        event_type: eventType,
        title,
        body:       message,
        is_read:    false,
      });
    }
  },

  getNotifications: async (userId: string, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      NotificationLog.find({ user_id: userId }).sort({ created_at: -1 }).skip(skip).limit(limit),
      NotificationLog.countDocuments({ user_id: userId }),
    ]);
    return { notifications, total, page, limit, unread: notifications.filter((n) => !n.is_read).length };
  },

  markRead: async (userId: string, notificationId: string) => {
    await NotificationLog.findOneAndUpdate(
      { _id: notificationId, user_id: userId },
      { is_read: true, delivered_at: new Date() },
    );
  },

  markAllRead: async (userId: string) => {
    await NotificationLog.updateMany({ user_id: userId, is_read: false }, { is_read: true });
  },
};
