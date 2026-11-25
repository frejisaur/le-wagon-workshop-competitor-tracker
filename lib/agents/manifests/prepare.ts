import {companyIdOf} from '@/lib/airtable/company-row';
import type {CompetitorStore} from '@/lib/airtable/types';
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

/** Prepares a deterministic, bounded manifest through the existing CompetitorStore boundary. */
export async function prepareInsights(options: PrepareInsightsOptions): Promise<PreparedManifest> {
  const limit = validatePreparedLimit(options.limit);
  const skillVersion = options.skillVersion ?? AGENT_SKILL_VERSION;
  const snapshot = await options.repository.getDashboardSnapshot();

  const prepared: PreparedCompany[] = [];
  const rows = snapshot.companies.flatMap((row) => { const companyId = companyIdOf(row); return companyId ? [{row, companyId}] : []; }).sort((left, right) => left.companyId.localeCompare(right.companyId));
  if (new Set(rows.map(({companyId}) => companyId)).size !== rows.length) throw new TypeError('duplicate_company_records');
  for (const {row, companyId} of rows) {
    if (options.companyId && companyId !== options.companyId) continue;
    const pkg = buildEvidencePackage(row);
    const evidenceFingerprint = fingerprintEvidence(pkg);
    const nextInsightDueAt = row.fields['Workflow • Next Insight Due At'];
    const dueReasons = selectDue({companyId, evidenceFingerprint, nextInsightDueAt: typeof nextInsightDueAt === 'string' ? nextInsightDueAt : undefined, published: pkg.published, review: pkg.review, skillVersion, now: options.now});
    if (options.due && dueReasons.length === 0) continue;
    prepared.push({...pkg, evidenceFingerprint, dueReasons});
    if (prepared.length >= limit) break;
  }
  return PreparedManifestSchema.parse({manifestVersion: PREPARED_MANIFEST_VERSION, skillVersion, dueOnly: options.due ?? false, limit, companies: prepared});
}
