import { db } from '../../core/database/postgres.client';
import { KycSubmissionRow, KycDocumentRow, KycStatus, RiskLevel } from './kyc.types';

export class KycRepository {
  async findSubmissionByUserId(userId: string): Promise<KycSubmissionRow | null> {
    const r = await db.query<KycSubmissionRow>(
      'SELECT * FROM kyc.submissions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId],
    );
    return r.rows[0] ?? null;
  }

  async findSubmissionById(id: string): Promise<KycSubmissionRow | null> {
    const r = await db.query<KycSubmissionRow>(
      'SELECT * FROM kyc.submissions WHERE id = $1',
      [id],
    );
    return r.rows[0] ?? null;
  }

  async createSubmission(userId: string): Promise<KycSubmissionRow> {
    const r = await db.query<KycSubmissionRow>(
      `INSERT INTO kyc.submissions (user_id, submission_count)
       VALUES ($1, 1) RETURNING *`,
      [userId],
    );
    return r.rows[0];
  }

  async updateSubmissionStatus(
    id: string,
    status: KycStatus,
    extra?: Partial<Pick<KycSubmissionRow,
      'risk_level' | 'onfido_applicant_id' | 'onfido_check_id' |
      'liveness_score' | 'reviewer_id' | 'review_notes' | 'reviewed_at' | 'submitted_at'
    >>,
  ): Promise<void> {
    const fields  = ['status = $1', 'updated_at = NOW()'];
    const values: unknown[] = [status];
    let idx = 2;

    if (extra?.risk_level)          { fields.push(`risk_level = $${idx++}`);          values.push(extra.risk_level); }
    if (extra?.onfido_applicant_id) { fields.push(`onfido_applicant_id = $${idx++}`); values.push(extra.onfido_applicant_id); }
    if (extra?.onfido_check_id)     { fields.push(`onfido_check_id = $${idx++}`);     values.push(extra.onfido_check_id); }
    if (extra?.liveness_score != null) { fields.push(`liveness_score = $${idx++}`);  values.push(extra.liveness_score); }
    if (extra?.reviewer_id)         { fields.push(`reviewer_id = $${idx++}`);         values.push(extra.reviewer_id); }
    if (extra?.review_notes)        { fields.push(`review_notes = $${idx++}`);        values.push(extra.review_notes); }
    if (extra?.reviewed_at)         { fields.push(`reviewed_at = $${idx++}`);         values.push(extra.reviewed_at); }
    if (extra?.submitted_at)        { fields.push(`submitted_at = $${idx++}`);        values.push(extra.submitted_at); }

    values.push(id);
    await db.query(
      `UPDATE kyc.submissions SET ${fields.join(', ')} WHERE id = $${idx}`,
      values,
    );
  }

  async createDocument(params: {
    submissionId: string;
    documentType: string;
    mongoDocId:   string;
    fileName:     string;
    mimeType:     string;
    fileSize:     number;
  }): Promise<KycDocumentRow> {
    const r = await db.query<KycDocumentRow>(
      `INSERT INTO kyc.documents
         (submission_id, document_type, mongo_doc_id, file_name, mime_type, file_size_bytes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [params.submissionId, params.documentType, params.mongoDocId,
       params.fileName, params.mimeType, params.fileSize],
    );
    return r.rows[0];
  }

  async getDocumentsBySubmission(submissionId: string): Promise<KycDocumentRow[]> {
    const r = await db.query<KycDocumentRow>(
      'SELECT * FROM kyc.documents WHERE submission_id = $1',
      [submissionId],
    );
    return r.rows;
  }

  async getQueue(filter: { status?: string; limit: number; offset: number }): Promise<{
    rows: Array<KycSubmissionRow & { first_name: string; last_name: string; email: string }>;
    total: number;
  }> {
    const conditions = filter.status ? 'WHERE ks.status = $3' : '';
    const params: unknown[] = [filter.limit, filter.offset];
    if (filter.status) params.push(filter.status);

    const [rows, count] = await Promise.all([
      db.query(
        `SELECT ks.*, u.first_name, u.last_name, u.email
         FROM kyc.submissions ks
         JOIN auth.users u ON u.id = ks.user_id
         ${conditions}
         ORDER BY ks.created_at DESC
         LIMIT $1 OFFSET $2`,
        params,
      ),
      db.query<{ count: string }>(
        `SELECT COUNT(*) FROM kyc.submissions ks ${conditions}`,
        filter.status ? [filter.status] : [],
      ),
    ]);

    return { rows: rows.rows as any, total: parseInt(count.rows[0].count, 10) };
  }

  async countSubmissions(userId: string): Promise<number> {
    const r = await db.query<{ count: string }>(
      'SELECT COUNT(*) FROM kyc.submissions WHERE user_id = $1',
      [userId],
    );
    return parseInt(r.rows[0].count, 10);
  }
}
