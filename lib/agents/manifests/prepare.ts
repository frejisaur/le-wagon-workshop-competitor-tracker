import type {CompetitorStore, DashboardSnapshot} from '@/lib/airtable/types';
import {buildEvidencePackage} from '@/lib/agents/evidence/build-package';
import {fingerprintEvidence} from '@/lib/agents/evidence/fingerprint';
import {AGENT_SKILL_VERSION, PREPARED_MANIFEST_VERSION, PreparedManifestSchema, validatePreparedLimit, type PreparedCompany, type PreparedManifest} from '@/lib/agents/types';
import {selectDue} from './select-due';

export type PrepareInsightsOptions = {
  due?: boolean;
  limit?: number;
  companyId?: string;
  repository: CompetitorStore;
  skillVersion?: string;
  now?: Date;
};

function byCompany(snapshot: DashboardSnapshot, field: string): Map<string, typeof snapshot.keywords> {
  const grouped = new Map<string, typeof snapshot.keywords>();
  for (const record of snapshot[field as keyof DashboardSnapshot] as typeof snapshot.keywords) {
    const companyId = record.fields['Identity • Company ID'];
    if (typeof companyId !== 'string' || !companyId) continue;
    const records = grouped.get(companyId) ?? [];
    records.push(record);
    grouped.set(companyId, records);
  }
  return grouped;
}

function metadataByCompany(records: DashboardSnapshot['publishedInsights'], kind: 'published' | 'review'): Map<string, DashboardSnapshot['publishedInsights'][number]> {
  const metadata = new Map<string, DashboardSnapshot['publishedInsights'][number]>();
  for (const record of records) {
    const companyId = record.fields['Identity • Company ID'];
    if (typeof companyId !== 'string' || !companyId) continue;
    if (metadata.has(companyId)) throw new TypeError(`duplicate_${kind}_records`);
    metadata.set(companyId, record);
  }
  return metadata;
}

/** Prepares a deterministic, bounded manifest through the existing CompetitorStore boundary. */
export async function prepareInsights(options: PrepareInsightsOptions): Promise<PreparedManifest> {
  const limit = validatePreparedLimit(options.limit);
  const skillVersion = options.skillVersion ?? AGENT_SKILL_VERSION;
  const snapshot = await options.repository.getDashboardSnapshot();
  const keywords = byCompany(snapshot, 'keywords');
  const paidAds = byCompany(snapshot, 'paidAds');
  const published = metadataByCompany(snapshot.publishedInsights, 'published');
  const reviews = metadataByCompany(snapshot.reviews, 'review');

  const prepared: PreparedCompany[] = [];
  for (const company of [...snapshot.companies].sort((left, right) => String(left.fields['Identity • Company ID']).localeCompare(String(right.fields['Identity • Company ID'])))) {
    const companyId = company.fields['Identity • Company ID'];
    if (typeof companyId !== 'string' || !companyId || options.companyId && companyId !== options.companyId) continue;
    const pkg = buildEvidencePackage({company, keywords: keywords.get(companyId) ?? [], paidAds: paidAds.get(companyId) ?? [], publishedInsight: published.get(companyId), review: reviews.get(companyId)});
    const evidenceFingerprint = fingerprintEvidence(pkg);
    const dueReasons = selectDue({companyId, evidenceFingerprint, nextInsightDueAt: typeof company.fields['Workflow • Next Insight Due At'] === 'string' ? company.fields['Workflow • Next Insight Due At'] : undefined, published: pkg.published, review: pkg.review, skillVersion, now: options.now});
    if (options.due && dueReasons.length === 0) continue;
    prepared.push({...pkg, evidenceFingerprint, dueReasons});
    if (prepared.length >= limit) break;
  }
  return PreparedManifestSchema.parse({manifestVersion: PREPARED_MANIFEST_VERSION, skillVersion, dueOnly: options.due ?? false, limit, companies: prepared});
}
