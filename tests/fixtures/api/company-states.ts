import {CompanyResponseSchema, type CompanyResponse, type DashboardValue} from '@/lib/domain/dashboard';

const at = '2026-08-18T12:00:00.000Z';
const freshness = {lastSuccessfulRunAt: at, cachedAt: '2026-08-18T12:01:00.000Z', isStale: false};
const observed = (value: number | null): DashboardValue => ({classification: 'observed', value, source: 'semrush', database: 'ca', observedAt: at});
const calculated = (value: number | null): DashboardValue => ({classification: 'calculated', value, source: 'semrush', database: 'ca', calculatedAt: at});
const claim = {claimId: 'claim-search-strength', conclusion: 'Search demand supports a focused competitive response.', classification: 'inferred' as const, confidence: 'high' as const, confidenceReason: 'Two current curated observations support this interpretation.', evidenceRefs: ['company:alpha:traffic', 'keyword:alpha:research']};
const publishedInsight = {overallConfidence: 'high' as const, generatedAt: at, workflow: {evidenceFingerprint: 'fixture-current-fingerprint', runId: 'fixture-run', harness: 'fixture-harness', model: 'fixture-model', skillVersion: '1.0.0', workflowVersion: '1.0.0'}, claims: [claim]};

const base = CompanyResponseSchema.parse({
  companyId: 'alpha', identity: {domain: 'alpha.example', displayName: 'Alpha', country: 'Canada', segment: 'Enterprise'}, status: 'succeeded', freshness,
  kpis: {authorityScore: observed(42), organicTraffic: observed(12_000), organicTraffic30DayMovement: calculated(0.15), organicKeywords: observed(900), aiBenchmarkGap: calculated(0.2), referringDomains: observed(450)},
  trend: [{date: '2026-06-01', organicTraffic: calculated(10_000)}, {date: '2026-07-01', organicTraffic: calculated(null)}, {date: '2026-08-01', organicTraffic: calculated(12_000)}],
  demand: {nonBrandShare: calculated(0.7)},
  keywords: [{keywordId: 'keyword-alpha', classification: 'observed', keyword: 'competitor research', landingUrl: 'https://alpha.example/research', position: 1, volume: 800, cpcUsd: 4.5, difficulty: 40, traffic: 100, intents: ['informational']}],
  landingPages: [{normalizedLandingUrl: 'https://alpha.example/research', keywordCount: 1, estimatedTraffic: 100, keywords: ['competitor research']}],
  competitors: [{domain: 'bravo.example', organicTraffic: 8_000, organicKeywords: 500, commonKeywords: 24}], countries: [{country: 'Canada', mentions: 5, visibility: 0.5}],
  ai: {visibility: observed(29), benchmark: observed(31), mentions: observed(583), citedPages: observed(208), byLlm: [{llm: 'ChatGPT', mentions: 182, selfMentions: 1, citedPages: 82}], topCitedSources: [{domain: 'source.example', mentions: 17}]},
  authority: {backlinks: observed(1_200), referringDomains: observed(450), followBacklinks: observed(900), noFollowBacklinks: observed(300)},
  paid: {traffic: observed(10), keywords: observed(2), ads: [{paidAdId: 'ad-alpha', keyword: 'competitor', title: 'Compare approaches', landingUrl: 'https://alpha.example/compare', position: 1}]},
  publishedInsightState: 'current', publishedInsight,
  evidence: [{ref: 'company:alpha:traffic', classification: 'observed', source: 'semrush', database: 'ca', observedAt: at, value: 12_000}, {ref: 'keyword:alpha:research', classification: 'observed', source: 'semrush', database: 'ca', observedAt: at, value: {keyword: 'competitor research', position: 1}}],
});

const withIdentity = (company: CompanyResponse, companyId: string, displayName: string): CompanyResponse => CompanyResponseSchema.parse({...company, companyId, identity: {...company.identity, domain: `${companyId}.example`, displayName}, publishedInsightState: 'absent', publishedInsight: undefined, reviewCandidate: undefined, evidence: [], paid: undefined});

export const companyStates = {
  current: base,
  noPaid: withIdentity(base, 'bravo', 'Bravo'),
  reviewRequired: CompanyResponseSchema.parse({...base, publishedInsightState: 'absent', publishedInsight: undefined, reviewCandidate: {status: 'needs_review', reasons: ['insufficient_evidence']}}),
  publishedPlusReview: CompanyResponseSchema.parse({...base, reviewCandidate: {status: 'needs_review', reasons: ['insufficient_evidence']}}),
  fingerprintMismatch: CompanyResponseSchema.parse({...withIdentity(base, 'charlie', 'Charlie'), status: 'stale', freshness: {...freshness, isStale: true}, recoveryMessage: 'Data is stale but remains available.', publishedInsightState: 'stale'}),
} satisfies Record<string, CompanyResponse>;
