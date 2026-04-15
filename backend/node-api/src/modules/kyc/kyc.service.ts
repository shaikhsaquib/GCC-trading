import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../shared/db/postgres';
import { KycDocument } from '../../shared/db/mongodb';
import { eventBus, Events } from '../../shared/events/event-bus';
import { encryptBuffer } from '../../shared/utils/crypto';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/middleware/error.middleware';
import { KycStatus, RiskLevel, UserStatus } from '../../shared/types';

const ONFIDO_BASE       = 'https://api.eu.onfido.com/v3.6';
const ONFIDO_KEY        = process.env.ONFIDO_API_KEY || '';
const LIVENESS_THRESHOLD = parseFloat(process.env.ONFIDO_LIVENESS_THRESHOLD || '0.8');
const MAX_RESUBMISSIONS  = 3;

const onfido = axios.create({
  baseURL: ONFIDO_BASE,
  headers: { Authorization: `Token token=${ONFIDO_KEY}`, 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// ── KYC Service ───────────────────────────────────────────────────────────────

export const kycService = {
  // ── Get current KYC status ─────────────────────────────────────────────────
  getStatus: async (userId: string) => {
    const result = await db.query(
      'SELECT * FROM kyc.submissions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId],
    );
    return result.rows[0] ?? null;
  },

  // ── Start KYC submission ───────────────────────────────────────────────────
  startSubmission: async (userId: string) => {
    // Check if already active submission
    const existing = await db.query(
      `SELECT id, status, resubmission_count FROM kyc.submissions
       WHERE user_id = $1 AND status NOT IN ('REJECTED','AUTO_APPROVED','APPROVED')`,
      [userId],
    );
    if (existing.rows.length > 0) {
      throw new AppError(409, 'KYC_ALREADY_SUBMITTED', 'An active KYC submission already exists');
    }

    // Check resubmission limit (FSD §KYC-022)
    const rejected = await db.query(
      `SELECT resubmission_count FROM kyc.submissions
       WHERE user_id = $1 AND status = 'REJECTED'
       ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    if (rejected.rows.length > 0 && rejected.rows[0].resubmission_count >= MAX_RESUBMISSIONS) {
      throw new AppError(422, 'KYC_MAX_ATTEMPTS', `Maximum ${MAX_RESUBMISSIONS} resubmissions reached`);
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO kyc.submissions (id, user_id, status, resubmission_count)
       VALUES ($1, $2, 'DRAFT', 0)`,
      [id, userId],
    );
    return { kyc_id: id, status: KycStatus.DRAFT };
  },

  // ── Upload document ────────────────────────────────────────────────────────
  uploadDocument: async (
    userId: string,
    kycId: string,
    documentType: string,
    file: Express.Multer.File,
  ) => {
    // Validate file (FSD §12.4)
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
    const MAX_SIZE      = documentType === 'SELFIE' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new AppError(400, 'KYC_INVALID_TYPE', 'Only JPG, PNG, and PDF files are accepted');
    }
    if (file.size > MAX_SIZE) {
      throw new AppError(400, 'KYC_DOC_TOO_LARGE', `Max file size: ${MAX_SIZE / 1024 / 1024}MB`);
    }

    // AES-256 encrypt and store in MongoDB (FSD §KYC-004)
    const { encrypted, iv } = encryptBuffer(file.buffer);

    await KycDocument.create({
      kyc_submission_id: kycId,
      user_id:           userId,
      document_type:     documentType,
      file_name:         file.originalname,
      file_size:         file.size,
      mime_type:         file.mimetype,
      encrypted_data:    encrypted,
      encryption_iv:     iv,
      is_verified:       false,
    });

    logger.info('KYC document uploaded', { user_id: userId, kyc_id: kycId, type: documentType });
    return { message: 'Document uploaded successfully', document_type: documentType };
  },

  // ── Submit KYC for processing ──────────────────────────────────────────────
  submit: async (userId: string, kycId: string, riskAnswers: number[]) => {
    // Calculate risk score from questionnaire (FSD §KYC-010)
    const riskScore = riskAnswers.reduce((sum, v) => sum + v, 0) / riskAnswers.length;
    const riskLevel = riskScore < 0.4 ? RiskLevel.LOW
                    : riskScore < 0.7 ? RiskLevel.MEDIUM
                    : RiskLevel.HIGH;

    // Create Onfido applicant
    const userRow = await db.query<{ first_name: string; last_name: string }>(
      'SELECT first_name, last_name FROM auth.users WHERE id = $1',
      [userId],
    );
    const user = userRow.rows[0];

    let applicantId: string | undefined;
    try {
      const applicantRes = await onfido.post('/applicants', {
        first_name: user.first_name,
        last_name:  user.last_name,
      });
      applicantId = applicantRes.data.id as string;
    } catch (err) {
      logger.error('Onfido applicant creation failed', { error: (err as Error).message });
      // Continue to manual review on Onfido failure (FSD §4.3 ONFIDO_FAILED)
    }

    await db.query(
      `UPDATE kyc.submissions SET
         status = 'SUBMITTED', risk_level = $1, risk_score = $2,
         onfido_applicant_id = $3, submitted_at = NOW()
       WHERE id = $4`,
      [riskLevel, riskScore, applicantId, kycId],
    );

    // Update user status (FSD §4.1)
    await db.query(
      `UPDATE auth.users SET status = 'KYC_SUBMITTED' WHERE id = $1`,
      [userId],
    );

    await eventBus.publish(Events.KYC_SUBMITTED, { user_id: userId, kyc_id: kycId, risk_level: riskLevel });
    return { status: KycStatus.SUBMITTED, risk_level: riskLevel };
  },

  // ── Onfido webhook handler ─────────────────────────────────────────────────
  handleOnfidoWebhook: async (payload: {
    payload: { resource_type: string; action: string; object: { id: string; status: string; results?: Record<string, unknown> } };
  }) => {
    if (payload.payload.resource_type !== 'check') return;

    const checkId       = payload.payload.object.id;
    const onfidoStatus  = payload.payload.object.status;
    const livenessScore = (payload.payload.object.results as { liveness?: number })?.liveness ?? 0;

    const kyc = await db.query(
      'SELECT * FROM kyc.submissions WHERE onfido_check_id = $1',
      [checkId],
    );
    if (kyc.rows.length === 0) return;

    const submission = kyc.rows[0] as { id: string; user_id: string; risk_level: string };

    if (onfidoStatus === 'complete') {
      const autoApprove =
        livenessScore >= LIVENESS_THRESHOLD &&
        submission.risk_level === RiskLevel.LOW;

      if (autoApprove) {
        await kycService.approve(submission.id, undefined, 'AUTO');
      } else {
        await db.query(
          `UPDATE kyc.submissions SET status = 'MANUAL_REVIEW', liveness_score = $1 WHERE id = $2`,
          [livenessScore, submission.id],
        );
        logger.info('KYC sent to manual review', { kyc_id: submission.id, liveness: livenessScore });
      }
    } else {
      await db.query(
        `UPDATE kyc.submissions SET status = 'ONFIDO_FAILED' WHERE id = $1`,
        [submission.id],
      );
    }
  },

  // ── Admin: Approve KYC ────────────────────────────────────────────────────
  approve: async (kycId: string, adminId?: string, method: 'MANUAL' | 'AUTO' = 'MANUAL') => {
    const kyc = await db.query(
      'SELECT * FROM kyc.submissions WHERE id = $1',
      [kycId],
    );
    if (kyc.rows.length === 0) throw new AppError(404, 'KYC_NOT_FOUND', 'KYC submission not found');

    const submission = kyc.rows[0] as { id: string; user_id: string; risk_level: string };

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE kyc.submissions SET status = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3`,
        [method === 'AUTO' ? KycStatus.AUTO_APPROVED : KycStatus.APPROVED, adminId, kycId],
      );
      await client.query(
        `UPDATE auth.users SET status = 'ACTIVE', risk_level = $1 WHERE id = $2`,
        [submission.risk_level, submission.user_id],
      );
    });

    // Publish KYCApproved (FSD §KYC-023) — triggers Wallet creation + Notification
    await eventBus.publish(Events.KYC_APPROVED, {
      user_id:    submission.user_id,
      kyc_id:     kycId,
      risk_level: submission.risk_level,
      approved_by: adminId,
    });

    logger.info('KYC approved', { kyc_id: kycId, method, admin: adminId });
    return { status: method === 'AUTO' ? KycStatus.AUTO_APPROVED : KycStatus.APPROVED };
  },

  // ── Admin: Reject KYC ─────────────────────────────────────────────────────
  reject: async (kycId: string, adminId: string, reason: string) => {
    const kyc = await db.query('SELECT * FROM kyc.submissions WHERE id = $1', [kycId]);
    if (kyc.rows.length === 0) throw new AppError(404, 'KYC_NOT_FOUND', 'KYC submission not found');

    const submission = kyc.rows[0] as { id: string; user_id: string; resubmission_count: number };
    const remaining  = MAX_RESUBMISSIONS - submission.resubmission_count;

    await db.query(
      `UPDATE kyc.submissions SET status = 'REJECTED', rejection_reason = $1,
       reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3`,
      [reason, adminId, kycId],
    );

    if (remaining > 0) {
      await db.query(`UPDATE auth.users SET status = 'KYC_RESUBMIT' WHERE id = $1`, [submission.user_id]);
    } else {
      await db.query(`UPDATE auth.users SET status = 'KYC_REJECTED' WHERE id = $1`, [submission.user_id]);
    }

    await eventBus.publish(Events.KYC_REJECTED, {
      user_id: submission.user_id,
      kyc_id:  kycId,
      reason,
      remaining_attempts: Math.max(0, remaining),
    });

    return { status: KycStatus.REJECTED, remaining_attempts: remaining };
  },

  // ── Get KYC queue (admin) ──────────────────────────────────────────────────
  getQueue: async (filters: { status?: string; country?: string; page?: number; limit?: number }) => {
    const { status, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) { conditions.push(`k.status = $${params.length + 1}`); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT k.*, u.first_name, u.last_name, u.country_code
       FROM kyc.submissions k
       JOIN auth.users u ON u.id = k.user_id
       ${where}
       ORDER BY k.submitted_at ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return result.rows;
  },
};
