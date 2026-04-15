import mongoose, { Schema, Document } from 'mongoose';
import { logger } from '../utils/logger';

export const connectMongoDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gcc_bond_audit';
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });
  logger.info('MongoDB: connected');
};

mongoose.connection.on('error', (err) =>
  logger.error('MongoDB connection error', { error: err.message }),
);

// ── Audit Log Schema (append-only, immutable) ─────────────────────────────────

export interface IAuditLog extends Document {
  event_id: string;
  event_type: string;
  actor_id?: string;
  actor_role?: string;
  target_id?: string;
  target_type?: string;
  action: string;
  metadata: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  correlation_id?: string;
  created_at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  event_id:       { type: String, required: true, unique: true, index: true },
  event_type:     { type: String, required: true, index: true },
  actor_id:       { type: String, index: true },
  actor_role:     { type: String },
  target_id:      { type: String, index: true },
  target_type:    { type: String },
  action:         { type: String, required: true },
  metadata:       { type: Schema.Types.Mixed, default: {} },
  ip_address:     { type: String },
  user_agent:     { type: String },
  correlation_id: { type: String, index: true },
  created_at:     { type: Date, default: Date.now, index: true },
}, {
  collection: 'audit_logs',
  timestamps: false,
});

// Make it truly immutable — no updates, no deletes
AuditLogSchema.pre('save',   function (next) { if (!this.isNew) throw new Error('Audit logs are immutable'); next(); });
AuditLogSchema.pre('updateOne', () => { throw new Error('Audit logs are immutable'); });
AuditLogSchema.pre('deleteOne', () => { throw new Error('Audit logs are immutable'); });

// 7-year retention — TTL index in seconds (7 * 365 * 24 * 3600)
AuditLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 220_752_000 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

// ── KYC Document Schema ────────────────────────────────────────────────────────

export interface IKycDocument extends Document {
  kyc_submission_id: string;
  user_id: string;
  document_type: 'ID_FRONT' | 'ID_BACK' | 'SELFIE' | 'BANK_STATEMENT';
  file_name: string;
  file_size: number;
  mime_type: string;
  encrypted_data: Buffer;    // AES-256 encrypted file content
  encryption_iv: string;
  onfido_document_id?: string;
  ocr_extracted_data?: Record<string, unknown>;
  is_verified: boolean;
  created_at: Date;
}

const KycDocumentSchema = new Schema<IKycDocument>({
  kyc_submission_id:  { type: String, required: true, index: true },
  user_id:            { type: String, required: true, index: true },
  document_type:      { type: String, required: true, enum: ['ID_FRONT', 'ID_BACK', 'SELFIE', 'BANK_STATEMENT'] },
  file_name:          { type: String, required: true },
  file_size:          { type: Number, required: true },
  mime_type:          { type: String, required: true },
  encrypted_data:     { type: Buffer, required: true },
  encryption_iv:      { type: String, required: true },
  onfido_document_id: { type: String },
  ocr_extracted_data: { type: Schema.Types.Mixed },
  is_verified:        { type: Boolean, default: false },
  created_at:         { type: Date, default: Date.now },
}, { collection: 'kyc_documents' });

export const KycDocument = mongoose.model<IKycDocument>('KycDocument', KycDocumentSchema);

// ── Notification History Schema ────────────────────────────────────────────────

export interface INotificationLog extends Document {
  user_id: string;
  channel: 'push' | 'email' | 'sms' | 'in_app';
  event_type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  delivered_at?: Date;
  created_at: Date;
}

const NotificationLogSchema = new Schema<INotificationLog>({
  user_id:      { type: String, required: true, index: true },
  channel:      { type: String, required: true, enum: ['push', 'email', 'sms', 'in_app'] },
  event_type:   { type: String, required: true },
  title:        { type: String, required: true },
  body:         { type: String, required: true },
  metadata:     { type: Schema.Types.Mixed },
  is_read:      { type: Boolean, default: false },
  delivered_at: { type: Date },
  created_at:   { type: Date, default: Date.now, index: true },
}, { collection: 'notification_logs' });

// 1-year TTL
NotificationLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 31_536_000 });

export const NotificationLog = mongoose.model<INotificationLog>(
  'NotificationLog',
  NotificationLogSchema,
);

export const mongoHealthCheck = async (): Promise<boolean> => {
  try {
    await mongoose.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
};
