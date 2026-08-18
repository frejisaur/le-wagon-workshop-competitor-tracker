import type {AirtableRecord} from '@/lib/airtable/types';

export const AGENT_SKILL_VERSION = '1.0.0';
export const PREPARED_MANIFEST_VERSION = '1.0.0';
export const MAX_PREPARED_COMPANIES = 10;

export type DueReason =
  | 'never_generated'
  | 'refresh_due'
  | 'fingerprint_changed'
  | 'skill_version_changed'
  | 'reviewer_requested_regeneration';

export type EvidenceClassification = 'observed' | 'calculated';
export type EvidenceScalar = string | number | boolean | null;
export type EvidenceValue = EvidenceScalar | EvidenceValue[] | {[key: string]: EvidenceValue};

/** A single citation-safe row from curated storage, never a raw provider object. */
export type EvidenceReference = {
  ref: string;
  classification: EvidenceClassification;
  source: string;
  database?: string;
  observedAt?: string;
  calculatedAt?: string;
  rawDatasetRef?: string;
  value: EvidenceValue;
};

export type PublishedInsightMetadata = {
  evidenceFingerprint?: string;
  skillVersion?: string;
  workflowVersion?: string;
};

export type ReviewMetadata = {
  status?: string;
  evidenceFingerprint?: string;
  skillVersion?: string;
  workflowVersion?: string;
  reviewReasons: string[];
  /** Reviewer-entered text is evidence data only; callers must never execute it as instructions. */
  untrustedReviewerNotes?: string;
};

export type EvidencePackage = {
  companyId: string;
  canonicalDomain?: string;
  evidence: EvidenceReference[];
  published?: PublishedInsightMetadata;
  review?: ReviewMetadata;
};

export type PreparedCompany = EvidencePackage & {
  evidenceFingerprint: string;
  dueReasons: DueReason[];
};

export type PreparedManifest = {
  manifestVersion: string;
  skillVersion: string;
  dueOnly: boolean;
  limit: number;
  companies: PreparedCompany[];
};

export type SelectDueInput = {
  companyId: string;
  evidenceFingerprint: string;
  nextInsightDueAt?: string;
  published?: PublishedInsightMetadata;
  review?: ReviewMetadata;
  skillVersion: string;
  now?: Date;
};

export type BuildEvidencePackageInput = {
  company: AirtableRecord;
  keywords: AirtableRecord[];
  paidAds: AirtableRecord[];
  publishedInsight?: AirtableRecord;
  review?: AirtableRecord;
};
