import {z} from 'zod';

export const DashboardStatusSchema = z.enum(['loading', 'empty', 'running', 'succeeded', 'partial', 'failed', 'stale']);
export type DashboardStatus = z.infer<typeof DashboardStatusSchema>;

const IsoTimestampSchema = z.string().datetime({offset: true});
export const ValueClassificationSchema = z.enum(['observed', 'calculated', 'inferred']);
export type ValueClassification = z.infer<typeof ValueClassificationSchema>;

/** A display value keeps its provenance class at the browser boundary. */
export const DashboardValueSchema = z.object({
  classification: ValueClassificationSchema,
  value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
  source: z.string().min(1).optional(),
  database: z.string().min(1).optional(),
  observedAt: IsoTimestampSchema.optional(),
  calculatedAt: IsoTimestampSchema.optional(),
  coverage: z.object({available: z.number().int().nonnegative(), total: z.number().int().nonnegative()}).strict().refine(({available, total}) => available <= total, 'coverage available cannot exceed total').optional(),
}).strict();
export type DashboardValue = z.infer<typeof DashboardValueSchema>;

export const FreshnessSchema = z.object({
  lastSuccessfulRunAt: IsoTimestampSchema.nullable(),
  cachedAt: IsoTimestampSchema.nullable(),
  isStale: z.boolean(),
}).strict();
export type Freshness = z.infer<typeof FreshnessSchema>;

const CompanySummarySchema = z.object({
  companyId: z.string().min(1),
  domain: z.string().min(1),
  displayName: z.string().min(1).optional(),
  /** Curated observed identity fields for landscape filtering; never raw provider payloads. */
  country: z.string().min(1).max(128).optional(),
  segment: z.string().min(1).max(128).optional(),
  authorityScore: DashboardValueSchema,
  organicTraffic: DashboardValueSchema,
  organicTraffic30DayMovement: DashboardValueSchema,
  nonBrandShare: DashboardValueSchema,
  organicKeywords: DashboardValueSchema,
  paidActivity: DashboardValueSchema,
  aiBenchmarkGap: DashboardValueSchema,
  referringDomains: DashboardValueSchema,
  freshness: FreshnessSchema,
}).strict();
export type CompanySummary = z.infer<typeof CompanySummarySchema>;

const MarketMapPointSchema = z.object({companyId: z.string().min(1), authorityScore: z.number().finite().nullable(), organicTraffic: z.number().finite().nullable(), trafficShare: z.number().finite().nullable(), aiBenchmarkGap: z.number().finite().nullable()}).strict();
const SignalSchema = z.object({companyId: z.string().min(1), kind: z.enum(['growth', 'paid_activity', 'ai_outperformance', 'non_brand_demand']), value: z.number().finite(), period: z.string().min(1)}).strict();

export const LandscapeResponseSchema = z.object({
  status: DashboardStatusSchema,
  freshness: FreshnessSchema,
  recoveryMessage: z.string().min(1).optional(),
  kpis: z.object({companiesTracked: DashboardValueSchema, combinedOrganicTraffic: DashboardValueSchema, organicKeywordFootprint: DashboardValueSchema, growingCompanies: DashboardValueSchema, paidActiveCompanies: DashboardValueSchema}).strict(),
  companies: z.array(CompanySummarySchema),
  marketMap: z.array(MarketMapPointSchema),
  signals: z.array(SignalSchema),
  filters: z.object({countries: z.array(z.string().min(1)), segments: z.array(z.string().min(1)), paidActivityAvailable: z.boolean(), aiPerformanceAvailable: z.boolean()}).strict(),
}).strict();
export type LandscapeResponse = z.infer<typeof LandscapeResponseSchema>;

const EvidenceSchema = z.object({ref: z.string().min(1), classification: z.enum(['observed', 'calculated']), source: z.string().min(1), database: z.string().min(1).optional(), observedAt: IsoTimestampSchema.optional(), calculatedAt: IsoTimestampSchema.optional(), value: z.unknown()}).strict();
const ClaimSchema = z.object({claimId: z.string().min(1), conclusion: z.string().min(1), classification: z.enum(['observed', 'inferred']), confidence: z.enum(['high', 'medium', 'low']), confidenceReason: z.string().min(1), evidenceRefs: z.array(z.string().min(1)).min(1)}).strict();
const PublishedWorkflowSchema = z.object({
  evidenceFingerprint: z.string().min(1),
  runId: z.string().min(1).max(256).optional(),
  harness: z.string().min(1).max(256).optional(),
  model: z.string().min(1).max(256).optional(),
  skillVersion: z.string().min(1).max(128).optional(),
  workflowVersion: z.string().min(1).max(128).optional(),
}).strict();

export const CompanyResponseSchema = z.object({
  companyId: z.string().min(1),
  identity: z.object({domain: z.string().min(1), displayName: z.string().min(1).optional(), segment: z.string().min(1).optional(), country: z.string().min(1).optional()}).strict(),
  status: DashboardStatusSchema,
  freshness: FreshnessSchema,
  recoveryMessage: z.string().min(1).optional(),
  kpis: z.object({authorityScore: DashboardValueSchema, organicTraffic: DashboardValueSchema, organicTraffic30DayMovement: DashboardValueSchema, organicKeywords: DashboardValueSchema, aiBenchmarkGap: DashboardValueSchema, referringDomains: DashboardValueSchema}).strict(),
  trend: z.array(z.object({date: z.string().min(1), organicTraffic: DashboardValueSchema}).strict()),
  demand: z.object({nonBrandShare: DashboardValueSchema}).strict(),
  keywords: z.array(z.object({keywordId: z.string().min(1), classification: z.literal('observed'), keyword: z.string().min(1), landingUrl: z.string().url(), position: z.number().finite().nullable(), volume: z.number().finite().nullable(), cpcUsd: z.number().finite().nullable(), difficulty: z.number().finite().nullable(), traffic: z.number().finite().nullable(), intents: z.array(z.string())}).strict()),
  landingPages: z.array(z.object({normalizedLandingUrl: z.string().url(), keywordCount: z.number().int().nonnegative(), estimatedTraffic: z.number().finite().nullable(), keywords: z.array(z.string())}).strict()),
  competitors: z.array(z.object({domain: z.string().min(1), organicTraffic: z.number().finite().nullable(), organicKeywords: z.number().finite().nullable(), commonKeywords: z.number().finite().nullable()}).strict()),
  paidCompetitors: z.object({classification: z.enum(['observed', 'calculated']), source: z.string().min(1).optional(), database: z.string().min(1).optional(), observedAt: IsoTimestampSchema.optional(), calculatedAt: IsoTimestampSchema.optional(), rows: z.array(z.object({domain: z.string().min(1), paidTraffic: z.number().finite().nullable(), paidKeywords: z.number().finite().nullable(), commonKeywords: z.number().finite().nullable()}).strict())}).strict().optional(),
  countries: z.array(z.object({country: z.string().min(1), mentions: z.number().finite().nullable(), visibility: z.number().finite().nullable()}).strict()),
  ai: z.object({visibility: DashboardValueSchema, benchmark: DashboardValueSchema, byLlm: z.array(z.object({llm: z.string().min(1), mentions: z.number().finite().nullable(), selfMentions: z.number().finite().nullable(), citedPages: z.number().finite().nullable()}).strict())}).strict(),
  authority: z.object({backlinks: DashboardValueSchema, referringDomains: DashboardValueSchema, followBacklinks: DashboardValueSchema, noFollowBacklinks: DashboardValueSchema, mozDomainAuthority: DashboardValueSchema.optional(), mozSpamScore: DashboardValueSchema.optional(), mozTopPages: z.array(z.object({url: z.string().url(), pageAuthority: z.number().finite().nullable()}).strict()).optional()}).strict(),
  paid: z.object({traffic: DashboardValueSchema, keywords: DashboardValueSchema, ads: z.array(z.object({paidAdId: z.string().min(1), keyword: z.string().nullable(), title: z.string().nullable(), landingUrl: z.string().url(), position: z.number().finite().nullable()}).strict())}).strict().optional(),
  publishedInsightState: z.enum(['current', 'stale', 'absent']),
  publishedInsight: z.object({overallConfidence: z.enum(['high', 'medium', 'low']).optional(), claims: z.array(ClaimSchema), generatedAt: IsoTimestampSchema.optional(), workflow: PublishedWorkflowSchema}).strict().optional(),
  reviewCandidate: z.object({status: z.enum(['needs_review', 'approved', 'rejected', 'stale', 'published']), reasons: z.array(z.string().min(1))}).strict().optional(),
  evidence: z.array(EvidenceSchema),
}).strict();
export type CompanyResponse = z.infer<typeof CompanyResponseSchema>;

/** Bounded comparison projection for the company workspace; detailed evidence never crosses this branch. */
export const CompanyComparisonSchema = z.object({
  companyId: z.string().min(1),
  identity: z.object({domain: z.string().min(1), displayName: z.string().min(1).optional()}).strict(),
  trend: CompanyResponseSchema.shape.trend,
}).strict();
export type CompanyComparison = z.infer<typeof CompanyComparisonSchema>;
