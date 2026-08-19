import type {AirtableFields, AirtableRecord, DashboardSnapshot} from '@/lib/airtable/types';
import {buildEvidencePackage} from '@/lib/agents/evidence/build-package';
import {fingerprintEvidence} from '@/lib/agents/evidence/fingerprint';
import {CompanyResponseSchema, type CompanyResponse, type DashboardValue, type Freshness} from '@/lib/domain/dashboard';
import {normalizeDomain, normalizeUrl} from '@/lib/transforms/normalize';

type JsonRecord = Record<string, unknown>;

function text(fields: AirtableFields, field: string): string | undefined { const value = fields[field]; return typeof value === 'string' && value.length > 0 ? value : undefined; }
function number(fields: AirtableFields, field: string): number | null { const value = fields[field]; return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function bool(fields: AirtableFields, field: string): boolean | null { const value = fields[field]; return typeof value === 'boolean' ? value : null; }
function parsedArray(fields: AirtableFields, field: string): JsonRecord[] { const raw = text(fields, field); if (!raw) return []; try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value.filter((item): item is JsonRecord => !!item && typeof item === 'object' && !Array.isArray(item)) : []; } catch { return []; } }
function stringList(fields: AirtableFields, field: string): string[] { const raw = text(fields, field); if (!raw) return []; try { const value: unknown = JSON.parse(raw); return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : []; } catch { return []; } }
function finite(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function string(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined; }
function iso(value: string | undefined): string | undefined { return value && !Number.isNaN(Date.parse(value)) ? value : undefined; }

function observed(fields: AirtableFields, field: string): DashboardValue { return {classification: 'observed', value: number(fields, `Observed • ${field}`), ...(text(fields, 'Observed • Source') ? {source: text(fields, 'Observed • Source')} : {}), ...(text(fields, 'Observed • Database') ? {database: text(fields, 'Observed • Database')} : {}), ...(iso(text(fields, 'Observed • At')) ? {observedAt: iso(text(fields, 'Observed • At'))} : {})}; }
function calculated(fields: AirtableFields, field: string): DashboardValue { return {classification: 'calculated', value: number(fields, `Calculated • ${field}`), ...(iso(text(fields, 'Calculated • At')) ? {calculatedAt: iso(text(fields, 'Calculated • At'))} : {})}; }
function calculatedBool(fields: AirtableFields, field: string): DashboardValue { return {classification: 'calculated', value: bool(fields, `Calculated • ${field}`), ...(iso(text(fields, 'Calculated • At')) ? {calculatedAt: iso(text(fields, 'Calculated • At'))} : {})}; }
function calculatedWithObservedProvenance(fields: AirtableFields, field: string): DashboardValue { return {...calculated(fields, field), ...(text(fields, 'Observed • Source') ? {source: text(fields, 'Observed • Source')} : {}), ...(text(fields, 'Observed • Database') ? {database: text(fields, 'Observed • Database')} : {})}; }

function reviewReasons(record: AirtableRecord): string[] { return stringList(record.fields, 'Inferred • Review Reasons JSON').filter((reason) => reason.length > 0).sort(); }
function claims(record: AirtableRecord, field: string): Array<{claimId: string; conclusion: string; classification: 'observed' | 'inferred'; confidence: 'high' | 'medium' | 'low'; confidenceReason: string; evidenceRefs: string[]}> {
  return parsedArray(record.fields, field).flatMap((claim) => {
    const claimId = string(claim.claimId); const conclusion = string(claim.conclusion); const classification = claim.classification;
    const confidence = claim.confidence; const confidenceReason = string(claim.confidenceReason); const evidenceRefs = Array.isArray(claim.evidenceRefs) && claim.evidenceRefs.every((item) => typeof item === 'string' && item.length > 0) ? claim.evidenceRefs : [];
    return claimId && conclusion && (classification === 'observed' || classification === 'inferred') && (confidence === 'high' || confidence === 'medium' || confidence === 'low') && confidenceReason && evidenceRefs.length ? [{claimId, conclusion, classification, confidence, confidenceReason, evidenceRefs}] : [];
  });
}

export function freshnessFor(snapshot: DashboardSnapshot, cachedAt: string | null, status: Freshness['isStale']): Freshness {
  const system = snapshot.system.find((record) => record.fields['Identity • System ID'] === 'system') ?? snapshot.system[0];
  const last = system ? iso(text(system.fields, 'Workflow • Last Successful Run At')) : undefined;
  return {lastSuccessfulRunAt: last ?? null, cachedAt, isStale: status};
}

/** Allow-listed company detail projection. Airtable record IDs and review notes never cross this boundary. */
export function shapeCompany(snapshot: DashboardSnapshot, company: AirtableRecord, freshness: Freshness, status: CompanyResponse['status'], recoveryMessage?: string): CompanyResponse {
  const fields = company.fields;
  const companyId = text(fields, 'Identity • Company ID');
  const domain = text(fields, 'Identity • Canonical Domain');
  if (!companyId || !domain) throw new TypeError('curated company record is missing stable identity');
  const keywords = snapshot.keywords.filter((record) => record.fields['Identity • Company ID'] === companyId).flatMap((record) => {
    const keywordId = text(record.fields, 'Identity • Keyword ID'); const keyword = text(record.fields, 'Observed • Keyword'); const landingUrl = text(record.fields, 'Observed • Landing URL');
    if (!keywordId || !keyword || !landingUrl || !URL.canParse(landingUrl)) return [];
    return [{keywordId, classification: 'observed' as const, keyword, landingUrl, position: number(record.fields, 'Observed • Position'), volume: number(record.fields, 'Observed • Volume'), cpcUsd: number(record.fields, 'Observed • CPC USD'), difficulty: number(record.fields, 'Observed • Keyword Difficulty'), traffic: number(record.fields, 'Observed • Traffic'), intents: stringList(record.fields, 'Observed • Intents JSON')}];
  }).sort((left, right) => left.keyword.localeCompare(right.keyword) || left.keywordId.localeCompare(right.keywordId));
  const paidAds = snapshot.paidAds.filter((record) => record.fields['Identity • Company ID'] === companyId).flatMap((record) => {
    const paidAdId = text(record.fields, 'Identity • Paid Ad ID'); const landingUrl = text(record.fields, 'Observed • Landing URL');
    return paidAdId && landingUrl && URL.canParse(landingUrl) ? [{paidAdId, keyword: text(record.fields, 'Observed • Keyword') ?? null, title: text(record.fields, 'Observed • Title') ?? null, landingUrl, position: number(record.fields, 'Observed • Position')}] : [];
  }).sort((left, right) => left.paidAdId.localeCompare(right.paidAdId));
  const competitorRows = (items: JsonRecord[]) => items.flatMap((item) => {
    const competitorDomain = string(item.domain); return competitorDomain && normalizeDomain(competitorDomain) !== normalizeDomain(domain) ? [{domain: competitorDomain, organicTraffic: finite(item.organicTraffic), organicKeywords: finite(item.organicKeywords), commonKeywords: finite(item.commonKeywords)}] : [];
  });
  const organicCompetitors = competitorRows(parsedArray(fields, 'Observed • Organic Competitors JSON')).sort((left, right) => left.domain.localeCompare(right.domain));
  const calculatedPaidCompetitors = parsedArray(fields, 'Calculated • Paid Competitors JSON'); const observedPaidCompetitors = parsedArray(fields, 'Observed • Paid Competitors JSON');
  const selectedPaidCompetitors = calculatedPaidCompetitors.length ? {classification: 'calculated' as const, items: calculatedPaidCompetitors} : observedPaidCompetitors.length ? {classification: 'observed' as const, items: observedPaidCompetitors} : undefined;
  const paidCompetitors = selectedPaidCompetitors ? {classification: selectedPaidCompetitors.classification, ...(selectedPaidCompetitors.classification === 'observed' ? {source: text(fields, 'Observed • Source'), database: text(fields, 'Observed • Database'), observedAt: iso(text(fields, 'Observed • At'))} : {source: text(fields, 'Observed • Source'), database: text(fields, 'Observed • Database'), calculatedAt: iso(text(fields, 'Calculated • At'))}), rows: competitorRows(selectedPaidCompetitors.items).sort((left, right) => left.domain.localeCompare(right.domain))} : undefined;
  const countries = parsedArray(fields, 'Observed • AI Countries JSON').flatMap((item) => { const country = string(item.country); const mentions = finite(item.mentions); const visibility = finite(item.visibility); return country && ((mentions ?? 0) !== 0 || (visibility ?? 0) !== 0) ? [{country, mentions, visibility}] : []; }).sort((left, right) => left.country.localeCompare(right.country));
  const byLlm = parsedArray(fields, 'Observed • AI by LLM JSON').flatMap((item) => { const llm = string(item.llm); return llm ? [{llm, mentions: finite(item.mentions), selfMentions: finite(item.selfMentions), citedPages: finite(item.citedPages)}] : []; }).sort((left, right) => left.llm.localeCompare(right.llm));
  // Trend is calculated from curated observed Semrush measurements. Carry the
  // same curated provider/database provenance so the chart can disclose it
  // without accepting raw records in the browser.
  const trend = parsedArray(fields, 'Calculated • Compact Organic Trend JSON').flatMap((item) => { const date = string(item.date); return date ? [{date, organicTraffic: {classification: 'calculated' as const, value: finite(item.organicTraffic), ...(text(fields, 'Observed • Source') ? {source: text(fields, 'Observed • Source')} : {}), ...(text(fields, 'Observed • Database') ? {database: text(fields, 'Observed • Database')} : {}), ...(iso(text(fields, 'Calculated • At')) ? {calculatedAt: iso(text(fields, 'Calculated • At'))} : {})}}] : []; }).sort((left, right) => left.date.localeCompare(right.date));
  const landingPages = parsedArray(fields, 'Calculated • Landing Page Portfolio JSON').flatMap((item) => { const normalizedLandingUrl = string(item.normalizedLandingUrl); const keywordCount = finite(item.keywordCount); const keywordsForPage = Array.isArray(item.keywords) && item.keywords.every((keyword) => typeof keyword === 'string') ? item.keywords : []; return normalizedLandingUrl && URL.canParse(normalizedLandingUrl) && keywordCount !== null ? [{normalizedLandingUrl, keywordCount, estimatedTraffic: finite(item.estimatedTraffic), keywords: keywordsForPage}] : []; }).sort((left, right) => left.normalizedLandingUrl.localeCompare(right.normalizedLandingUrl));
  const mozTopPages = parsedArray(fields, 'Calculated • Moz Top Pages JSON').flatMap((item) => { const url = string(item.normalizedUrl); const normalized = url ? normalizeUrl(url) : null; return normalized ? [{url: normalized, pageAuthority: finite(item.pageAuthority)}] : []; }).sort((left, right) => left.url.localeCompare(right.url));
  const published = snapshot.publishedInsights.find((record) => record.fields['Identity • Company ID'] === companyId);
  const review = snapshot.reviews.find((record) => record.fields['Identity • Company ID'] === companyId);
  const evidencePackage = buildEvidencePackage({company, keywords: snapshot.keywords.filter((record) => record.fields['Identity • Company ID'] === companyId), paidAds: snapshot.paidAds.filter((record) => record.fields['Identity • Company ID'] === companyId), publishedInsight: published, review});
  const evidence = evidencePackage.evidence;
  const resolvable = new Set(evidence.map((item) => item.ref));
  const publishedClaims = published ? [...claims(published, 'Observed • Themes JSON'), ...claims(published, 'Inferred • Claims JSON'), ...claims(published, 'Inferred • Recommendations JSON')].filter((claim) => claim.evidenceRefs.every((ref) => resolvable.has(ref))) : [];
  // Task 7's canonical hash deliberately ignores publication metadata, so only
  // the current curated company/keyword/ad evidence determines freshness.
  const currentFingerprint = fingerprintEvidence(evidencePackage);
  const publishedIsCurrent = published && text(published.fields, 'Workflow • Evidence Fingerprint') === currentFingerprint;
  const reviewStatus = review ? text(review.fields, 'Review • Status') : undefined;
  const paidPresent = bool(fields, 'Calculated • Paid Activity Present') === true && (number(fields, 'Observed • Paid Traffic') !== null || number(fields, 'Observed • Paid Keywords') !== null || paidAds.length > 0);
  return CompanyResponseSchema.parse({
    companyId, identity: {domain, ...(text(fields, 'Observed • Display Name') ? {displayName: text(fields, 'Observed • Display Name')} : {}), ...(text(fields, 'Observed • Segment') ? {segment: text(fields, 'Observed • Segment')} : {}), ...(text(fields, 'Observed • Apollo Company Country') ? {country: text(fields, 'Observed • Apollo Company Country')} : {})},
    status, freshness, ...(recoveryMessage ? {recoveryMessage} : {}),
    kpis: {authorityScore: observed(fields, 'Authority Score'), organicTraffic: observed(fields, 'Organic Traffic'), organicTraffic30DayMovement: calculated(fields, 'Organic Traffic 30d Movement'), organicKeywords: observed(fields, 'Organic Keywords'), aiBenchmarkGap: calculated(fields, 'AI Benchmark Gap'), referringDomains: observed(fields, 'Referring Domains')},
    trend, demand: {nonBrandShare: calculated(fields, 'Non-brand Share')}, keywords, landingPages, competitors: organicCompetitors, ...(paidCompetitors ? {paidCompetitors} : {}), countries,
    ai: {visibility: observed(fields, 'AI Visibility'), benchmark: observed(fields, 'AI Visibility Benchmark'), byLlm},
    authority: {backlinks: observed(fields, 'Backlinks'), referringDomains: observed(fields, 'Referring Domains'), followBacklinks: observed(fields, 'Follow Backlinks'), noFollowBacklinks: observed(fields, 'No-follow Backlinks'), ...(number(fields, 'Calculated • Moz Domain Authority') !== null ? {mozDomainAuthority: calculatedWithObservedProvenance(fields, 'Moz Domain Authority')} : {}), ...(number(fields, 'Calculated • Moz Spam Score') !== null ? {mozSpamScore: calculatedWithObservedProvenance(fields, 'Moz Spam Score')} : {}), ...(mozTopPages.length ? {mozTopPages} : {})},
    ...(paidPresent ? {paid: {traffic: observed(fields, 'Paid Traffic'), keywords: observed(fields, 'Paid Keywords'), ads: paidAds}} : {}),
    publishedInsightState: published ? publishedIsCurrent ? 'current' : 'stale' : 'absent',
    ...(publishedIsCurrent ? {publishedInsight: {overallConfidence: text(published!.fields, 'Inferred • Overall Confidence') as 'high' | 'medium' | 'low' | undefined, claims: publishedClaims, ...(iso(text(published!.fields, 'Workflow • Generated At')) ? {generatedAt: iso(text(published!.fields, 'Workflow • Generated At'))} : {}), evidenceFingerprint: currentFingerprint}} : {}),
    ...(reviewStatus === 'needs_review' || reviewStatus === 'approved' || reviewStatus === 'rejected' || reviewStatus === 'stale' || reviewStatus === 'published' ? {reviewCandidate: {status: reviewStatus, reasons: reviewReasons(review!)}} : {}),
    evidence: evidence.map(({ref, classification, source, database, observedAt, calculatedAt, value}) => ({ref, classification, source, ...(database ? {database} : {}), ...(observedAt ? {observedAt} : {}), ...(calculatedAt ? {calculatedAt} : {}), value})),
  });
}
