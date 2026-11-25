import type {CompanyRow} from '@/lib/airtable/company-row';
import type {AirtableFields, DashboardSnapshot} from '@/lib/airtable/types';
import {buildEvidencePackage} from '@/lib/agents/evidence/build-package';
import {fingerprintEvidence} from '@/lib/agents/evidence/fingerprint';
import {CompanyResponseSchema, type CompanyResponse, type DashboardValue, type Freshness} from '@/lib/domain/dashboard';
import type {CandidateClaim} from '@/lib/schemas/insight-candidate';
import {normalizeDomain, normalizeUrl} from '@/lib/transforms/normalize';

type JsonRecord = Record<string, unknown>;

function text(fields: AirtableFields, field: string): string | undefined { const value = fields[field]; return typeof value === 'string' && value.length > 0 ? value : undefined; }
function number(fields: AirtableFields, field: string): number | null { const value = fields[field]; return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function bool(fields: AirtableFields, field: string): boolean | null { const value = fields[field]; return typeof value === 'boolean' ? value : null; }
function parsedArray(fields: AirtableFields, field: string): JsonRecord[] { const raw = text(fields, field); if (!raw) return []; try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value.filter((item): item is JsonRecord => !!item && typeof item === 'object' && !Array.isArray(item)) : []; } catch { return []; } }
function finite(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function string(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined; }
function iso(value: string | undefined): string | undefined { return value && !Number.isNaN(Date.parse(value)) ? value : undefined; }

function observed(fields: AirtableFields, field: string): DashboardValue { return {classification: 'observed', value: number(fields, `Observed • ${field}`), ...(text(fields, 'Observed • Source') ? {source: text(fields, 'Observed • Source')} : {}), ...(text(fields, 'Observed • Database') ? {database: text(fields, 'Observed • Database')} : {}), ...(iso(text(fields, 'Observed • At')) ? {observedAt: iso(text(fields, 'Observed • At'))} : {})}; }
function calculated(fields: AirtableFields, field: string): DashboardValue { return {classification: 'calculated', value: number(fields, `Calculated • ${field}`), ...(iso(text(fields, 'Calculated • At')) ? {calculatedAt: iso(text(fields, 'Calculated • At'))} : {})}; }
function calculatedBool(fields: AirtableFields, field: string): DashboardValue { return {classification: 'calculated', value: bool(fields, `Calculated • ${field}`), ...(iso(text(fields, 'Calculated • At')) ? {calculatedAt: iso(text(fields, 'Calculated • At'))} : {})}; }
function calculatedWithObservedProvenance(fields: AirtableFields, field: string): DashboardValue { return {...calculated(fields, field), ...(text(fields, 'Observed • Source') ? {source: text(fields, 'Observed • Source')} : {}), ...(text(fields, 'Observed • Database') ? {database: text(fields, 'Observed • Database')} : {})}; }
function calculatedTrendValue(fields: AirtableFields, value: unknown): DashboardValue { return {classification: 'calculated', value: finite(value), ...(text(fields, 'Observed • Source') ? {source: text(fields, 'Observed • Source')} : {}), ...(text(fields, 'Observed • Database') ? {database: text(fields, 'Observed • Database')} : {}), ...(iso(text(fields, 'Calculated • At')) ? {calculatedAt: iso(text(fields, 'Calculated • At'))} : {})}; }

function overallConfidence(claims: CandidateClaim[]): CandidateClaim['confidence'] {
  return claims.reduce<CandidateClaim['confidence']>((lowest, claim) => ({high: 0, medium: 1, low: 2}[claim.confidence] > {high: 0, medium: 1, low: 2}[lowest] ? claim.confidence : lowest), 'high');
}

export function freshnessFor(snapshot: DashboardSnapshot, cachedAt: string | null, status: Freshness['isStale']): Freshness {
  return {lastSuccessfulRunAt: iso(snapshot.system?.lastSuccessfulRunAt) ?? null, cachedAt, isStale: status};
}

/** Allow-listed company detail projection. Airtable record IDs and review notes never cross this boundary. */
export function shapeCompany(row: CompanyRow, freshness: Freshness, status: CompanyResponse['status'], recoveryMessage?: string): CompanyResponse {
  const fields = row.fields;
  const companyId = text(fields, 'Identity • Company ID');
  const domain = text(fields, 'Identity • Canonical Domain');
  if (!companyId || !domain) throw new TypeError('curated company record is missing stable identity');
  const keywords = row.keywords.flatMap(({observed, calculated}) => observed.landingUrl && URL.canParse(observed.landingUrl)
    ? [{keywordId: calculated.keywordId, classification: 'observed' as const, keyword: observed.keyword, landingUrl: observed.landingUrl, position: observed.position, volume: observed.volume, cpcUsd: observed.cpcUsd, difficulty: observed.keywordDifficulty, traffic: observed.traffic, intents: observed.intents}]
    : []).sort((left, right) => left.keyword.localeCompare(right.keyword) || left.keywordId.localeCompare(right.keywordId));
  const paidAds = row.paidAds.flatMap(({observed, calculated}) => URL.canParse(observed.landingUrl) ? [{paidAdId: calculated.paidAdId, keyword: observed.keyword || null, title: observed.title || null, landingUrl: observed.landingUrl, position: observed.position}] : [])
    .sort((left, right) => left.paidAdId.localeCompare(right.paidAdId));
  const organicCompetitorRows = (items: JsonRecord[]) => items.flatMap((item) => {
    const competitorDomain = string(item.domain); return competitorDomain && normalizeDomain(competitorDomain) !== normalizeDomain(domain) ? [{domain: competitorDomain, organicTraffic: finite(item.organicTraffic), organicKeywords: finite(item.organicKeywords), commonKeywords: finite(item.commonKeywords)}] : [];
  });
  const paidCompetitorRows = (items: JsonRecord[]) => items.flatMap((item) => {
    const competitorDomain = string(item.domain); return competitorDomain && normalizeDomain(competitorDomain) !== normalizeDomain(domain) ? [{domain: competitorDomain, paidTraffic: finite(item.paidTraffic), paidKeywords: finite(item.paidKeywords), commonKeywords: finite(item.commonKeywords)}] : [];
  });
  const organicCompetitors = organicCompetitorRows(parsedArray(fields, 'Observed • Organic Competitors JSON')).sort((left, right) => left.domain.localeCompare(right.domain));
  const calculatedPaidCompetitors = parsedArray(fields, 'Calculated • Paid Competitors JSON'); const observedPaidCompetitors = parsedArray(fields, 'Observed • Paid Competitors JSON');
  const selectedPaidCompetitors = calculatedPaidCompetitors.length ? {classification: 'calculated' as const, items: calculatedPaidCompetitors} : observedPaidCompetitors.length ? {classification: 'observed' as const, items: observedPaidCompetitors} : undefined;
  const paidCompetitors = selectedPaidCompetitors ? {classification: selectedPaidCompetitors.classification, ...(selectedPaidCompetitors.classification === 'observed' ? {source: text(fields, 'Observed • Source'), database: text(fields, 'Observed • Database'), observedAt: iso(text(fields, 'Observed • At'))} : {source: text(fields, 'Observed • Source'), database: text(fields, 'Observed • Database'), calculatedAt: iso(text(fields, 'Calculated • At'))}), rows: paidCompetitorRows(selectedPaidCompetitors.items).sort((left, right) => left.domain.localeCompare(right.domain))} : undefined;
  const countries = parsedArray(fields, 'Observed • AI Countries JSON').flatMap((item) => { const country = string(item.country); const mentions = finite(item.mentions); const visibility = finite(item.visibility); return country && ((mentions ?? 0) !== 0 || (visibility ?? 0) !== 0) ? [{country, mentions, visibility}] : []; }).sort((left, right) => left.country.localeCompare(right.country));
  const byLlm = parsedArray(fields, 'Observed • AI by LLM JSON').flatMap((item) => { const llm = string(item.llm); return llm ? [{llm, mentions: finite(item.mentions), selfMentions: finite(item.selfMentions), citedPages: finite(item.citedPages)}] : []; }).sort((left, right) => left.llm.localeCompare(right.llm));
  const topCitedSources = parsedArray(fields, 'Observed • AI Top Cited Sources JSON').flatMap((item) => { const domain = string(item.domain); const normalized = domain ? normalizeDomain(domain) : null; return normalized ? [{domain: normalized, mentions: finite(item.mentions)}] : []; }).slice(0, 10);
  // Trend is calculated from curated observed Semrush measurements. Carry the
  // same curated provider/database provenance so the chart can disclose it
  // without accepting raw records in the browser.
  const trend = parsedArray(fields, 'Calculated • Compact Organic Trend JSON').flatMap((item) => {
    const date = string(item.date);
    return date ? [{
      date,
      organicTraffic: calculatedTrendValue(fields, item.organicTraffic),
      organicKeywords: calculatedTrendValue(fields, item.organicKeywords),
      organicTrafficCostUsd: calculatedTrendValue(fields, item.organicTrafficCostUsd),
      brandedTraffic: calculatedTrendValue(fields, item.brandedTraffic),
      nonBrandTraffic: calculatedTrendValue(fields, item.nonBrandTraffic),
      paidTraffic: calculatedTrendValue(fields, item.paidTraffic),
      paidKeywords: calculatedTrendValue(fields, item.paidKeywords),
      paidTrafficCostUsd: calculatedTrendValue(fields, item.paidTrafficCostUsd),
      serpFeatureTraffic: calculatedTrendValue(fields, item.serpFeatureTraffic),
    }] : [];
  }).sort((left, right) => left.date.localeCompare(right.date));
  const landingPages = parsedArray(fields, 'Calculated • Landing Page Portfolio JSON').flatMap((item) => { const normalizedLandingUrl = string(item.normalizedLandingUrl); const keywordCount = finite(item.keywordCount); const keywordsForPage = Array.isArray(item.keywords) && item.keywords.every((keyword) => typeof keyword === 'string') ? item.keywords : []; return normalizedLandingUrl && URL.canParse(normalizedLandingUrl) && keywordCount !== null ? [{normalizedLandingUrl, keywordCount, estimatedTraffic: finite(item.estimatedTraffic), keywords: keywordsForPage}] : []; }).sort((left, right) => left.normalizedLandingUrl.localeCompare(right.normalizedLandingUrl));
  const mozTopPages = parsedArray(fields, 'Calculated • Moz Top Pages JSON').flatMap((item) => { const url = string(item.normalizedUrl); const normalized = url ? normalizeUrl(url) : null; return normalized ? [{url: normalized, pageAuthority: finite(item.pageAuthority)}] : []; }).sort((left, right) => left.url.localeCompare(right.url));
  const published = row.battlecard;
  const evidencePackage = buildEvidencePackage(row);
  const evidence = evidencePackage.evidence;
  const resolvable = new Set(evidence.map((item) => item.ref));
  const publishedClaims = published ? [...published.observedThemes, ...published.inferredClaims, ...published.recommendations] : [];
  // The canonical hash deliberately ignores publication metadata, so only the
  // current curated company, keyword and paid-ad evidence determines freshness.
  const currentFingerprint = fingerprintEvidence(evidencePackage);
  const publishedIsCurrent = Boolean(published && published.evidenceFingerprint === currentFingerprint && publishedClaims.length > 0 && publishedClaims.every((claim) => claim.evidenceRefs.every((ref) => resolvable.has(ref))));
  // An unreadable stored battlecard is withheld as stale, never shown as absent: a published insight exists.
  const battlecardUnreadable = row.storageIssues.some((issue) => issue.sourcePath === 'storage.battlecard');
  const review = row.review;
  const paidPresent = bool(fields, 'Calculated • Paid Activity Present') === true && (number(fields, 'Observed • Paid Traffic') !== null || number(fields, 'Observed • Paid Keywords') !== null || paidAds.length > 0);
  return CompanyResponseSchema.parse({
    companyId, identity: {domain, ...(text(fields, 'Observed • Display Name') ? {displayName: text(fields, 'Observed • Display Name')} : {}), ...(text(fields, 'Observed • Segment') ? {segment: text(fields, 'Observed • Segment')} : {}), ...(text(fields, 'Observed • Apollo Company Country') ? {country: text(fields, 'Observed • Apollo Company Country')} : {})},
    status, freshness, ...(iso(text(fields, 'Observed • At')) ? {enrichedAt: iso(text(fields, 'Observed • At'))} : {}), ...(recoveryMessage ? {recoveryMessage} : {}),
    kpis: {authorityScore: observed(fields, 'Authority Score'), organicTraffic: observed(fields, 'Organic Traffic'), organicTraffic30DayMovement: calculated(fields, 'Organic Traffic 30d Movement'), organicKeywords: observed(fields, 'Organic Keywords'), aiBenchmarkGap: calculated(fields, 'AI Benchmark Gap'), referringDomains: observed(fields, 'Referring Domains')},
    trend, demand: {nonBrandShare: calculated(fields, 'Non-brand Share')}, keywords, landingPages, competitors: organicCompetitors, ...(paidCompetitors ? {paidCompetitors} : {}), countries,
    ai: {visibility: observed(fields, 'AI Visibility'), benchmark: observed(fields, 'AI Visibility Benchmark'), mentions: observed(fields, 'AI Mentions'), citedPages: observed(fields, 'AI Cited Pages'), byLlm, topCitedSources},
    authority: {backlinks: observed(fields, 'Backlinks'), referringDomains: observed(fields, 'Referring Domains'), followBacklinks: observed(fields, 'Follow Backlinks'), noFollowBacklinks: observed(fields, 'No-follow Backlinks'), ...(number(fields, 'Calculated • Moz Domain Authority') !== null ? {mozDomainAuthority: calculatedWithObservedProvenance(fields, 'Moz Domain Authority')} : {}), ...(number(fields, 'Calculated • Moz Spam Score') !== null ? {mozSpamScore: calculatedWithObservedProvenance(fields, 'Moz Spam Score')} : {}), ...(mozTopPages.length ? {mozTopPages} : {})},
    ...(paidPresent ? {paid: {traffic: observed(fields, 'Paid Traffic'), keywords: observed(fields, 'Paid Keywords'), ads: paidAds}} : {}),
    publishedInsightState: published || battlecardUnreadable ? publishedIsCurrent ? 'current' : 'stale' : 'absent',
    ...(published && publishedIsCurrent ? {publishedInsight: {overallConfidence: overallConfidence(publishedClaims), claims: publishedClaims, generatedAt: published.generatedAt, workflow: {evidenceFingerprint: currentFingerprint, runId: published.runId, harness: published.agentHarness, model: published.model, skillVersion: published.skillVersion, workflowVersion: published.workflowVersion}}} : {}),
    ...(review?.status ? {reviewCandidate: {status: review.status, reasons: [...new Set(review.candidate?.reviewReasons ?? [])].sort()}} : {}),
    evidence: evidence.map(({ref, classification, source, database, observedAt, calculatedAt, value}) => ({ref, classification, source, ...(database ? {database} : {}), ...(observedAt ? {observedAt} : {}), ...(calculatedAt ? {calculatedAt} : {}), value})),
  });
}
