export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export type NotificationEvent =
  | 'WELCOME'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'DEPOSIT_SUCCESS'
  | 'WITHDRAWAL_INITIATED'
  | 'TRADE_EXECUTED'
  | 'COUPON_RECEIVED'
  | 'MATURITY_ALERT'
  | 'PASSWORD_CHANGED'
  | 'ACCOUNT_SUSPENDED'
  | 'SETTLEMENT_COMPLETE';

export interface SendNotificationDto {
  userId:    string;
  email?:    string;
  phone?:    string;
  fcmToken?: string;
  eventType: NotificationEvent;
  channels:  NotificationChannel[];
  vars:      Record<string, string>;
}

export interface NotificationTemplate {
  subject:  string;
  body:     string;
  smsBody?: string;
  pushTitle?: string;
  pushBody?:  string;
}
