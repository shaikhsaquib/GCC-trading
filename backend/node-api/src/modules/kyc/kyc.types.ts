export type KycStatus = 'Draft' | 'Submitted' | 'UnderReview' | 'Approved' | 'Rejected';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type DocumentType =
  | 'PASSPORT' | 'NATIONAL_ID' | 'DRIVING_LICENSE'
  | 'PROOF_OF_ADDRESS' | 'SELFIE' | 'LIVENESS_VIDEO';

export interface KycSubmissionRow {
  id:                  string;
  user_id:             string;
  status:              KycStatus;
  risk_level:          RiskLevel | null;
  onfido_applicant_id: string | null;
  onfido_check_id:     string | null;
  liveness_score:      number | null;
  submission_count:    number;
  reviewer_id:         string | null;
  review_notes:        string | null;
  reviewed_at:         Date | null;
  submitted_at:        Date | null;
  created_at:          Date;
  updated_at:          Date;
}

export interface KycDocumentRow {
  id:            string;
  submission_id: string;
  document_type: DocumentType;
  mongo_doc_id:  string;
  file_name:     string;
  mime_type:     string;
  file_size_bytes: number;
  status:        string;
  created_at:    Date;
}

// DTOs
export interface UploadDocumentDto {
  submissionId:  string;
  documentType:  DocumentType;
  file:          Express.Multer.File;
}

export interface ApproveKycDto {
  riskLevel:    RiskLevel;
  reviewNotes?: string;
}

export interface RejectKycDto {
  reason: string;
}

export interface KycQueueFilter {
  status?: KycStatus;
  limit?:  number;
  offset?: number;
}
