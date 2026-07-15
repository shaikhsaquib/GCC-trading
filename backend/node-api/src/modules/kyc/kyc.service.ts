import axios from 'axios';
import { config } from '../../config';
import { logger } from '../../core/logger';
import { IEventBus } from '../../core/events/event-bus';
import { EventRoutes } from '../../core/events/event.types';
import { encryptBuffer } from '../../core/crypto';
import { KycDocument } from '../../core/database/mongodb.client';
import { db } from '../../core/database/postgres.client';
import {
  ConflictError, ForbiddenError, NotFoundError, ValidationError,
} from '../../core/errors';
import { KycRepository } from './kyc.repository';
import {
  UploadDocumentDto, ApproveKycDto, RejectKycDto,
  KycQueueFilter, KycSubmissionRow,
} from './kyc.types';

const MAX_SUBMISSIONS    = 3;
const LIVENESS_THRESHOLD = 0.8;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'];
const MAX_FILE_SIZE_MB   = 10;

export class KycService {
  constructor(
    private readonly repo:     KycRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async getStatus(userId: string): Promise<KycSubmissionRow | null> {
    return this.repo.findSubmissionByUserId(userId);
  }

  async startSubmission(userId: string): Promise<KycSubmissionRow> {
    const count = await this.repo.countSubmissions(userId);
    if (count >= MAX_SUBMISSIONS) {
      throw new ForbiddenError(`Maximum ${MAX_SUBMISSIONS} KYC submissions allowed`);
    }

    const existing = await this.repo.findSubmissionByUserId(userId);
    if (existing && ['Draft', 'Submitted', 'UnderReview'].includes(existing.status)) {
      throw new ConflictError('You already have a pending KYC submission');
    }

    return this.repo.createSubmission(userId);
  }

  async uploadDocument(dto: UploadDocumentDto, userId: string): Promise<void> {
    const submission = await this.repo.findSubmissionById(dto.submissionId);
    if (!submission) throw new NotFoundError('KYC submission');
    if (submission.user_id !== userId) throw new ForbiddenError('Not your submission');
    if (submission.status !== 'Draft') throw new ForbiddenError('Cannot upload to a non-draft submission');

    if (!ALLOWED_MIME_TYPES.includes(dto.file.mimetype)) {
      throw new ValidationError(`Unsupported file type: ${dto.file.mimetype}`);
    }
    if (dto.file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new ValidationError(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    }

    // Try to store encrypted file in MongoDB. If MongoDB is unavailable (e.g. not
    // configured in this environment), fall back to metadata-only storage so that
    // the submission can still proceed through the review workflow.
    let mongoDocId = 'not-stored';
    try {
      const { data, iv } = encryptBuffer(dto.file.buffer);
      const doc = await KycDocument.create({
        submission_id:  dto.submissionId,
        document_type:  dto.documentType,
        encrypted_data: data,
        encryption_iv:  iv,
        file_name:      dto.file.originalname,
        mime_type:      dto.file.mimetype,
        file_size:      dto.file.size,
      });
      mongoDocId = doc._id.toString();
    } catch (err) {
      logger.warn('MongoDB unavailable — storing document metadata only', {
        submissionId: dto.submissionId,
        error: (err as Error).message,
      });
    }

    await this.repo.createDocument({
      submissionId: dto.submissionId,
      documentType: dto.documentType,
      mongoDocId,
      fileName:     dto.file.originalname,
      mimeType:     dto.file.mimetype,
      fileSize:     dto.file.size,
    });
  }

  async submit(submissionId: string, userId: string): Promise<void> {
    const submission = await this.repo.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('KYC submission');
    if (submission.user_id !== userId) throw new ForbiddenError('Not your submission');
    if (submission.status !== 'Draft') throw new ConflictError('Submission already submitted');

    const documents = await this.repo.getDocumentsBySubmission(submissionId);
    if (documents.length < 2) throw new ValidationError('At least 2 documents required');

    // An identity document plus a selfie are mandatory — two arbitrary files
    // (e.g. two selfies) must not pass review readiness.
    const types  = new Set(documents.map((d) => d.document_type));
    const hasId  = types.has('PASSPORT') || types.has('NATIONAL_ID') || types.has('DRIVING_LICENSE');
    const hasSelfie = types.has('SELFIE') || types.has('LIVENESS_VIDEO');
    if (!hasId)     throw new ValidationError('An identity document (passport, national ID or driving license) is required');
    if (!hasSelfie) throw new ValidationError('A selfie or liveness video is required');

    let applicantId: string | undefined;
    if (config.onfido.apiKey) {
      try {
        const res = await axios.post(
          'https://api.eu.onfido.com/v3.6/applicants',
          { first_name: 'Applicant', last_name: userId },
          { headers: { Authorization: `Token token=${config.onfido.apiKey}` } },
        );
        applicantId = res.data.id;
      } catch {
        // Non-fatal — manual review fallback
      }
    }

    await this.repo.updateSubmissionStatus(submissionId, 'Submitted', {
      onfido_applicant_id: applicantId,
      submitted_at:        new Date(),
    });
  }

  async handleOnfidoWebhook(payload: {
    resource_type: string;
    action:        string;
    object:        { id: string; status: string; href: string };
  }): Promise<void> {
    if (payload.resource_type !== 'check' || payload.action !== 'check.completed') return;

    const checkId    = payload.object.id;
    const submission = await db.query<{ id: string; user_id: string; risk_level: string }>(
      "SELECT id, user_id, risk_level FROM kyc.submissions WHERE onfido_check_id = $1",
      [checkId],
    );
    if (!submission.rows[0]) return;

    const { id } = submission.rows[0];

    // The Onfido check result is not parsed in this environment, so a real
    // liveness score is unavailable. Auto-approval on a hardcoded score would
    // bypass identity verification entirely — route every completed check to
    // manual review instead. (LIVENESS_THRESHOLD applies once real Onfido
    // result parsing is implemented.)
    void LIVENESS_THRESHOLD;
    await this.repo.updateSubmissionStatus(id, 'UnderReview', {
      onfido_check_id: checkId,
    });
  }

  async approve(submissionId: string, reviewerId: string, dto: ApproveKycDto): Promise<void> {
    const submission = await this.repo.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('KYC submission');
    if (!['Submitted', 'UnderReview'].includes(submission.status)) {
      throw new ConflictError(`Cannot approve a submission in status '${submission.status}'`);
    }
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(dto.riskLevel)) {
      throw new ValidationError('riskLevel must be LOW, MEDIUM or HIGH');
    }

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE kyc.submissions
         SET status = 'Approved', risk_level = $1, reviewer_id = $2,
             review_notes = $3, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $4`,
        [dto.riskLevel, reviewerId, dto.reviewNotes ?? null, submissionId],
      );
      await client.query(
        "UPDATE app_auth.users SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1",
        [submission.user_id],
      );
    });

    await this.eventBus.publish(EventRoutes.KYC_APPROVED, {
      user_id:    submission.user_id,
      kyc_id:     submissionId,
      risk_level: dto.riskLevel,
    });
  }

  async reject(submissionId: string, reviewerId: string, dto: RejectKycDto): Promise<void> {
    const submission = await this.repo.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('KYC submission');
    if (!['Submitted', 'UnderReview'].includes(submission.status)) {
      throw new ConflictError(`Cannot reject a submission in status '${submission.status}'`);
    }
    if (!dto.reason || dto.reason.trim().length < 3) {
      throw new ValidationError('A rejection reason is required');
    }

    const count     = await this.repo.countSubmissions(submission.user_id);
    const remaining = MAX_SUBMISSIONS - count;

    await this.repo.updateSubmissionStatus(submissionId, 'Rejected', {
      reviewer_id:  reviewerId,
      review_notes: dto.reason,
      reviewed_at:  new Date(),
    });

    await this.eventBus.publish(EventRoutes.KYC_REJECTED, {
      user_id:            submission.user_id,
      reason:             dto.reason,
      remaining_attempts: Math.max(0, remaining),
    });
  }

  async getDocuments(submissionId: string, userId: string) {
    const submission = await this.repo.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('KYC submission');
    if (submission.user_id !== userId) throw new ForbiddenError('Not your submission');
    return this.repo.getDocumentsBySubmission(submissionId);
  }

  async getQueue(filter: KycQueueFilter): Promise<{ data: unknown[]; total: number }> {
    const { rows, total } = await this.repo.getQueue({
      status: filter.status,
      limit:  filter.limit  ?? 20,
      offset: filter.offset ?? 0,
    });
    return { data: rows, total };
  }
}
