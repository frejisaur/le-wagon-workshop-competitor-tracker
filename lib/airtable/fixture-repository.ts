import {readFileSync} from 'node:fs';
import type {CuratedKeyword, CuratedPaidAd} from '@/lib/domain/metrics';
import {toAirtableCompanyFields, toAirtableInsightFields, toAirtableKeywordFields, toAirtablePaidAdFields, toAirtableReviewFields, toAirtableSystemFields} from './mappers';
import {AIRTABLE_TABLES, type AirtableRecord, type CompanyWrite, type CompetitorStore, type DashboardSnapshot, type DueInsightInput, type InsightWireInput, type ReviewWireInput, type SystemWireInput, type WriteResult} from './types';

type FixtureSnapshot = Partial<Record<'companies' | 'keywords' | 'paidAds' | 'insights' | 'reviews' | 'system', AirtableRecord[]>>;

function result(identity: string, recordId: string): WriteResult {
  return {succeeded: 1, failed: 0, results: [{identity, recordId}]};
}

function recordId(table: string, identity: string): string {
  return `fixture-${table.toLowerCase().replace(/\s+/g, '-')}-${encodeURIComponent(identity)}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** In-memory fixture implementation. The source JSON is read once and is never written or mutated. */
export class FixtureCompetitorRepository implements CompetitorStore {
  private readonly tables = new Map<string, Map<string, AirtableRecord>>();

  private constructor(snapshot: FixtureSnapshot) {
    const tableKeys: Array<keyof FixtureSnapshot> = ['companies', 'keywords', 'paidAds', 'insights', 'reviews', 'system'];
    for (const key of tableKeys) {
      const records = snapshot[key] ?? [];
      if (!Array.isArray(records)) throw new TypeError(`Fixture ${key} must be an array`);
      this.tables.set(key, new Map(records.map((record) => [record.id, clone(record)])));
    }
  }

  static fromSnapshot(path: string): FixtureCompetitorRepository {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('Fixture snapshot must be an object');
    return new FixtureCompetitorRepository(parsed as FixtureSnapshot);
  }

  async resolveCompanyIdentity(identity: {apolloAccountId: string; canonicalDomain: string}): Promise<{companyId: string; source: 'apollo_account_id' | 'canonical_domain'} | null> {
    const companies = this.records('companies');
    if (identity.apolloAccountId) {
      const match = companies.find((record) => record.fields['Observed • Apollo Account ID'] === identity.apolloAccountId);
      const companyId = match?.fields['Identity • Company ID'];
      if (typeof companyId === 'string') return {companyId, source: 'apollo_account_id'};
    }
    const match = companies.find((record) => record.fields['Identity • Canonical Domain'] === identity.canonicalDomain);
    const companyId = match?.fields['Identity • Company ID'];
    return typeof companyId === 'string' ? {companyId, source: 'canonical_domain'} : null;
  }

  async upsertCompanies(companies: CompanyWrite[]): Promise<WriteResult> {
    return this.upsertMany('companies', companies.map((company) => ({identity: company.companyId, fields: toAirtableCompanyFields(company), lookupField: 'Identity • Company ID'})));
  }

  async replaceKeywords(companyId: string, keywords: CuratedKeyword[]): Promise<WriteResult> {
    const writes = await this.upsertMany('keywords', keywords.map((keyword) => ({identity: keyword.calculated.keywordId, fields: toAirtableKeywordFields(keyword), lookupField: 'Identity • Keyword ID'})));
    if (writes.failed) return writes;
    const incoming = new Set(keywords.map((keyword) => keyword.calculated.keywordId));
    for (const [id, record] of this.table('keywords')) {
      if (record.fields['Identity • Company ID'] === companyId && !incoming.has(String(record.fields['Identity • Keyword ID']))) this.table('keywords').delete(id);
    }
    return writes;
  }

  async upsertPaidAds(paidAds: CuratedPaidAd[]): Promise<WriteResult> {
    return this.upsertMany('paidAds', paidAds.map((ad) => ({identity: ad.calculated.paidAdId, fields: toAirtablePaidAdFields(ad), lookupField: 'Identity • Paid Ad ID'})));
  }

  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    return {companies: this.records('companies'), keywords: this.records('keywords'), paidAds: this.records('paidAds'), publishedInsights: this.records('insights')};
  }

  async getDueInsightInputs(): Promise<DueInsightInput[]> {
    const insights = new Map(this.records('insights').map((record) => [String(record.fields['Identity • Company ID']), record]));
    const reviews = new Map(this.records('reviews').map((record) => [String(record.fields['Identity • Company ID']), record]));
    const now = Date.now();
    return this.records('companies').flatMap((company) => {
      const companyId = company.fields['Identity • Company ID'];
      if (typeof companyId !== 'string') return [];
      const publishedInsight = insights.get(companyId);
      const dueAt = company.fields['Workflow • Next Insight Due At'];
      const changed = publishedInsight?.fields['Workflow • Evidence Fingerprint'] !== company.fields['Workflow • Evidence Fingerprint'];
      return !publishedInsight || changed || (typeof dueAt === 'string' && Date.parse(dueAt) <= now) ? [{company, publishedInsight, review: reviews.get(companyId)}] : [];
    });
  }

  async upsertReview(review: ReviewWireInput): Promise<WriteResult> {
    return this.upsertMany('reviews', [{identity: review.companyId, fields: toAirtableReviewFields(review), lookupField: 'Identity • Company ID'}]);
  }

  async upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult> {
    return this.upsertMany('insights', [{identity: insight.insightId, fields: toAirtableInsightFields(insight), lookupField: 'Identity • Insight ID'}]);
  }

  async updateSystem(system: SystemWireInput): Promise<WriteResult> {
    return this.upsertMany('system', [{identity: system.systemId, fields: toAirtableSystemFields(system), lookupField: 'Identity • System ID'}]);
  }

  private async upsertMany(key: keyof FixtureSnapshot, writes: Array<{identity: string; fields: AirtableRecord['fields']; lookupField: string}>): Promise<WriteResult> {
    const table = this.table(key);
    const results = writes.map((write) => {
      const existing = [...table.values()].find((record) => record.fields[write.lookupField] === write.identity);
      const id = existing?.id ?? recordId(key, write.identity);
      table.set(id, {id, fields: clone(write.fields)});
      return {identity: write.identity, recordId: id};
    });
    return {succeeded: results.length, failed: 0, results};
  }

  private table(key: keyof FixtureSnapshot): Map<string, AirtableRecord> {
    const table = this.tables.get(key);
    if (!table) throw new TypeError(`Missing fixture table ${key}`);
    return table;
  }

  private records(key: keyof FixtureSnapshot): AirtableRecord[] {
    return [...this.table(key).values()].map(clone);
  }
}
