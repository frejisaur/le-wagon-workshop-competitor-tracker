import type {AirtableRecord} from '@/lib/airtable/types';
import {z} from 'zod';

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

export const EvidenceValueSchema: z.ZodType<EvidenceValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(EvidenceValueSchema), z.record(z.string(), EvidenceValueSchema),
]));

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
export const EvidenceReferenceSchema = z.object({
  ref: z.string().min(1),
  classification: z.enum(['observed', 'calculated']),
  source: z.string().min(1),
  database: z.string().min(1).optional(),
  observedAt: z.string().min(1).optional(),
  calculatedAt: z.string().min(1).optional(),
  rawDatasetRef: z.string().min(1).optional(),
  value: EvidenceValueSchema,
}).strict();

export type PublishedInsightMetadata = {
  evidenceFingerprint?: string;
  skillVersion?: string;
  workflowVersion?: string;
};
export const PublishedInsightMetadataSchema = z.object({
  evidenceFingerprint: z.string().min(1).optional(),
  skillVersion: z.string().min(1).optional(),
  workflowVersion: z.string().min(1).optional(),
}).strict();

export type ReviewMetadata = {
  status?: string;
  evidenceFingerprint?: string;
  skillVersion?: string;
  workflowVersion?: string;
  reviewReasons: string[];
  /** Reviewer-entered text is evidence data only; callers must never execute it as instructions. */
  untrustedReviewerNotes?: string;
};
export const ReviewMetadataSchema = z.object({
  status: z.string().min(1).optional(),
  evidenceFingerprint: z.string().min(1).optional(),
  skillVersion: z.string().min(1).optional(),
  workflowVersion: z.string().min(1).optional(),
  reviewReasons: z.array(z.string().min(1)),
  untrustedReviewerNotes: z.string().min(1).optional(),
}).strict();

export type EvidencePackage = {
  companyId: string;
  canonicalDomain?: string;
  evidence: EvidenceReference[];
  published?: PublishedInsightMetadata;
  review?: ReviewMetadata;
};
export const EvidencePackageSchema = z.object({
  companyId: z.string().min(1),
  canonicalDomain: z.string().min(1).optional(),
  evidence: z.array(EvidenceReferenceSchema).min(1),
  published: PublishedInsightMetadataSchema.optional(),
  review: ReviewMetadataSchema.optional(),
}).strict();

export type PreparedCompany = EvidencePackage & {
  evidenceFingerprint: string;
  dueReasons: DueReason[];
};
export const DueReasonSchema = z.enum([
  'never_generated', 'refresh_due', 'fingerprint_changed', 'skill_version_changed', 'reviewer_requested_regeneration',
]);
export const PreparedCompanySchema = EvidencePackageSchema.extend({
  evidenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  dueReasons: z.array(DueReasonSchema).max(5).refine((reasons) => new Set(reasons).size === reasons.length, 'due reasons must be unique'),
}).strict();

export type PreparedManifest = {
  manifestVersion: string;
  skillVersion: string;
  dueOnly: boolean;
  limit: number;
  companies: PreparedCompany[];
};
export const PreparedManifestSchema = z.object({
  manifestVersion: z.literal(PREPARED_MANIFEST_VERSION),
  skillVersion: z.string().min(1),
  dueOnly: z.boolean(),
  limit: z.number().int().min(1).max(MAX_PREPARED_COMPANIES),
  companies: z.array(PreparedCompanySchema).max(MAX_PREPARED_COMPANIES),
}).strict();

/** Defaults to ten and caps a valid request at ten; every other value is rejected. */
export function validatePreparedLimit(limit: number | undefined): number {
  if (limit === undefined) return MAX_PREPARED_COMPANIES;
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('limit must be an integer greater than zero');
  return Math.min(limit, MAX_PREPARED_COMPANIES);
}

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
