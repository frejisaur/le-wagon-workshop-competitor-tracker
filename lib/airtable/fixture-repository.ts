import {readFileSync} from 'node:fs';
import type {CuratedKeyword, CuratedPaidAd} from '@/lib/domain/metrics';
import {toAirtableCompanyFields, toAirtableInsightFields, toAirtableKeywordFields, toAirtablePaidAdFields, toAirtableReviewFields, toAirtableSystemFields} from './mappers';
import {type AirtableRecord, type CompanyWrite, type CompetitorStore, type DashboardSnapshot, type DueInsightInput, type InsightWireInput, type ReviewWireInput, type SystemWireInput, type WriteResult} from './types';

type FixtureSnapshot = Partial<Record<'companies' | 'keywords' | 'paidAds' | 'insights' | 'reviews' | 'system', AirtableRecord[]>>;

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
    const results: WriteResult['results'] = [];
    for (const company of companies) {
      const existing = this.findCompanyRecord(company);
      if (existing && existing.fields['Identity • Company ID'] !== company.companyId) {
        results.push({identity: company.companyId, error: 'identity_conflict'});
        continue;
      }
      const id = existing?.id ?? recordId('companies', company.companyId);
      this.table('companies').set(id, {id, fields: clone(toAirtableCompanyFields(company))});
      results.push({identity: company.companyId, recordId: id});
    }
    return {succeeded: results.filter((item) => !item.error).length, failed: results.filter((item) => item.error).length, results};
  }

  async replaceKeywords(companyId: string, keywords: CuratedKeyword[]): Promise<WriteResult> {
    const company = this.findCompanyRecordById(companyId);
    if (!company) return {succeeded: 0, failed: keywords.length, results: keywords.map((keyword) => ({identity: keyword.calculated.keywordId, error: 'company_link_missing'}))};
    const writes = await this.upsertMany('keywords', keywords.map((keyword) => ({identity: keyword.calculated.keywordId, fields: toAirtableKeywordFields(keyword, company.id), lookupField: 'Identity • Keyword ID'})));
    if (writes.failed) return writes;
    const incoming = new Set(keywords.map((keyword) => keyword.calculated.keywordId));
    for (const [id, record] of this.table('keywords')) {
      if (record.fields['Identity • Company ID'] === companyId && !incoming.has(String(record.fields['Identity • Keyword ID']))) this.table('keywords').delete(id);
    }
    return writes;
  }

  async upsertPaidAds(paidAds: CuratedPaidAd[]): Promise<WriteResult> {
    const results: WriteResult['results'] = [];
    const byCompany = new Map<string, CuratedPaidAd[]>();
    for (const ad of paidAds) {
      const group = byCompany.get(ad.calculated.companyId) ?? [];
      group.push(ad);
      byCompany.set(ad.calculated.companyId, group);
    }
    for (const [companyId, ads] of byCompany) {
      const company = this.findCompanyRecordById(companyId);
      if (!company) {
        results.push(...ads.map((ad) => ({identity: ad.calculated.paidAdId, error: 'company_link_missing'})));
        continue;
      }
      for (const ad of ads) {
        const existing = [...this.table('paidAds').values()].find((record) => record.fields['Identity • Paid Ad ID'] === ad.calculated.paidAdId);
        const firstObservedAt = existing?.fields['Observed • First Observed At'];
        const lastObservedAt = existing?.fields['Observed • Last Observed At'];
        const written = await this.upsertMany('paidAds', [{identity: ad.calculated.paidAdId, fields: toAirtablePaidAdFields(ad, company.id, typeof firstObservedAt === 'string' ? firstObservedAt : undefined, typeof lastObservedAt === 'string' ? lastObservedAt : undefined), lookupField: 'Identity • Paid Ad ID'}]);
        results.push(...written.results);
      }
    }
    return {succeeded: results.filter((item) => !item.error).length, failed: results.filter((item) => item.error).length, results};
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
    const company = this.findCompanyRecordById(review.companyId);
    return company ? this.upsertMany('reviews', [{identity: review.companyId, fields: toAirtableReviewFields(review, company.id), lookupField: 'Identity • Company ID'}]) : {succeeded: 0, failed: 1, results: [{identity: review.companyId, error: 'company_link_missing'}]};
  }

  async upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult> {
    const company = this.findCompanyRecordById(insight.companyId);
    return company ? this.upsertMany('insights', [{identity: insight.insightId, fields: toAirtableInsightFields(insight, company.id), lookupField: 'Identity • Insight ID'}]) : {succeeded: 0, failed: 1, results: [{identity: insight.insightId, error: 'company_link_missing'}]};
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

  private findCompanyRecord(company: CompanyWrite): AirtableRecord | undefined {
    if (company.identity.apolloAccountId) {
      const byAccount = this.records('companies').find((record) => record.fields['Observed • Apollo Account ID'] === company.identity.apolloAccountId);
      if (byAccount) return byAccount;
    }
    const byDomain = this.records('companies').find((record) => record.fields['Identity • Canonical Domain'] === company.identity.canonicalDomain);
    return byDomain ?? this.findCompanyRecordById(company.companyId);
  }

  private findCompanyRecordById(companyId: string): AirtableRecord | undefined {
    return this.records('companies').find((record) => record.fields['Identity • Company ID'] === companyId);
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
