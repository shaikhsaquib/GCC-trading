import mongoose, { Schema, Document, Model } from 'mongoose';
import { config } from '../../config';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export async function connectMongoDB(): Promise<void> {
  await mongoose.connect(config.mongodb.uri);
  logger.info('MongoDB connected');
}

export async function mongoHealthCheck(): Promise<boolean> {
  return mongoose.connection.readyState === 1;
}

// ---------------------------------------------------------------------------
// AuditLog — immutable, 7-year retention (FSD §19)
// ---------------------------------------------------------------------------

export interface IAuditLog extends Document {
  event_type:     string;
  action:         string;
  actor_id?:      string;
  target_id?:     string;
  target_type?:   string;
  metadata?:      Record<string, unknown>;
  correlation_id?: string;
  ip_address?:    string;
  user_agent?:    string;
  created_at:     Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    event_type:      { type: String, required: true, index: true },
    action:          { type: String, required: true },
    actor_id:        { type: String, index: true },
    target_id:       { type: String, index: true },
    target_type:     { type: String },
    metadata:        { type: Schema.Types.Mixed },
    correlation_id:  { type: String },
    ip_address:      { type: String },
    user_agent:      { type: String },
    created_at:      { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, versionKey: false },
);

// 7-year TTL (FSD §19 — GCC regulatory retention requirement)
auditLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 7 });

// Enforce immutability — block all mutations
function blockMutation(this: unknown): never {
  throw new Error('AuditLog records are immutable');
}

auditLogSchema.pre('updateOne',  blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('deleteOne',  blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);
auditLogSchema.pre('findOneAndUpdate', blockMutation);

export const AuditLog: Model<IAuditLog> = mongoose.model('AuditLog', auditLogSchema);

// ---------------------------------------------------------------------------
// KycDocument — encrypted file storage
// ---------------------------------------------------------------------------

export interface IKycDocument extends Document {
  submission_id:  string;
  document_type:  string;
  encrypted_data: Buffer;
  encryption_iv:  Buffer;
  file_name:      string;
  mime_type:      string;
  file_size:      number;
  created_at:     Date;
}

const kycDocumentSchema = new Schema<IKycDocument>(
  {
    submission_id:  { type: String, required: true, index: true },
    document_type:  { type: String, required: true },
    encrypted_data: { type: Buffer,  required: true },
    encryption_iv:  { type: Buffer,  required: true },
    file_name:      { type: String,  required: true },
    mime_type:      { type: String,  required: true },
    file_size:      { type: Number,  required: true },
    created_at:     { type: Date,    default: Date.now },
  },
  { timestamps: false },
);

export const KycDocument: Model<IKycDocument> = mongoose.model('KycDocument', kycDocumentSchema);

// ---------------------------------------------------------------------------
// NotificationLog — 1-year TTL
// ---------------------------------------------------------------------------

export interface INotificationLog extends Document {
  user_id:    string;
  event_type: string;
  channels:   string[];
  vars:       Record<string, string>;
  read:       boolean;
  created_at: Date;
}

const notificationLogSchema = new Schema<INotificationLog>(
  {
    user_id:    { type: String, required: true, index: true },
    event_type: { type: String, required: true },
    channels:   [{ type: String }],
    vars:       { type: Schema.Types.Mixed, default: {} },
    read:       { type: Boolean, default: false },
    created_at: { type: Date,   default: Date.now },
  },
  { timestamps: false },
);

notificationLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

export const NotificationLog: Model<INotificationLog> = mongoose.model('NotificationLog', notificationLogSchema);
