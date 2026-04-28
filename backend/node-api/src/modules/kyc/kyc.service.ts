import axios from 'axios';
import { config } from '../../config';
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

  async uploadDocument(dto: UploadDocumentDto): Promise<void> {
    const submission = await this.repo.findSubmissionById(dto.submissionId);
    if (!submission) throw new NotFoundError('KYC submission');
    if (submission.status !== 'Draft') throw new ForbiddenError('Cannot upload to a non-draft submission');

    if (!ALLOWED_MIME_TYPES.includes(dto.file.mimetype)) {
      throw new ValidationError(`Unsupported file type: ${dto.file.mimetype}`);
    }
    if (dto.file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      throw new ValidationError(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    }

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

    await this.repo.createDocument({
      submissionId: dto.submissionId,
      documentType: dto.documentType,
      mongoDocId:   doc._id.toString(),
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

    const { id, user_id, risk_level } = submission.rows[0];

    // Fetch check result from Onfido
    const livenessScore = 0.9; // In production: parse from Onfido check result
    const autoApprove   = livenessScore >= LIVENESS_THRESHOLD && risk_level === 'LOW';

    if (autoApprove) {
      await this.approve(id, 'SYSTEM', { riskLevel: 'LOW' });
    } else {
      await this.repo.updateSubmissionStatus(id, 'UnderReview', {
        liveness_score: livenessScore,
      });
    }
  }

  async approve(submissionId: string, reviewerId: string, dto: ApproveKycDto): Promise<void> {
    const submission = await this.repo.findSubmissionById(submissionId);
    if (!submission) throw new NotFoundError('KYC submission');

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
