import type {CuratedKeyword, CuratedPaidAd} from '@/lib/domain/metrics';
import {AirtableClient, AirtableClientError} from './client';
import {toAirtableCompanyFields, toAirtableInsightFields, toAirtableKeywordFields, toAirtablePaidAdFields, toAirtableReviewFields, toAirtableSystemFields} from './mappers';
import {AIRTABLE_TABLES, type AirtableFields, type AirtableRecord, type AirtableTable, type CompanyWrite, type CompetitorStore, type DashboardSnapshot, type DueInsightInput, type InsightWireInput, type RecordResult, type ReviewWireInput, type SystemWireInput, type WriteResult} from './types';

const BATCH_SIZE = 10;

function chunks<T>(items: T[]): T[][] {
  return Array.from({length: Math.ceil(items.length / BATCH_SIZE)}, (_, index) => items.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE));
}

/** Escapes untrusted string data used in a quoted Airtable formula literal. */
export function escapeFormulaLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r\n|\r|\n/g, '\\n');
}

function equalityFormula(field: string, value: string): string {
  return `{${field}}='${escapeFormulaLiteral(value)}'`;
}

function errorMessage(error: unknown): string {
  if (error instanceof AirtableClientError) return error.message;
  return 'Airtable request failed';
}

function emptyResult(): WriteResult {
  return {succeeded: 0, failed: 0, results: []};
}

function firstCompanyId(record: AirtableRecord): string | null {
  const value = record.fields['Identity • Company ID'];
  return typeof value === 'string' && value ? value : null;
}

type WriteItem = {identity: string; fields: AirtableFields; recordId?: string};

/** Server-only Airtable adapter. Its public methods expose curated domain inputs and typed wire records only. */
export class AirtableCompetitorRepository implements CompetitorStore {
  constructor(private readonly client: AirtableClient) {}

  async resolveCompanyIdentity(identity: {apolloAccountId: string; canonicalDomain: string}): Promise<{companyId: string; source: 'apollo_account_id' | 'canonical_domain'} | null> {
    if (identity.apolloAccountId) {
      const byAccount = await this.client.list(AIRTABLE_TABLES.companies, {filterByFormula: equalityFormula('Observed • Apollo Account ID', identity.apolloAccountId)});
      const companyId = byAccount.map(firstCompanyId).find((value): value is string => value !== null);
      if (companyId) return {companyId, source: 'apollo_account_id'};
    }
    if (identity.canonicalDomain) {
      const byDomain = await this.client.list(AIRTABLE_TABLES.companies, {filterByFormula: equalityFormula('Identity • Canonical Domain', identity.canonicalDomain)});
      const companyId = byDomain.map(firstCompanyId).find((value): value is string => value !== null);
      if (companyId) return {companyId, source: 'canonical_domain'};
    }
    return null;
  }

  async upsertCompanies(companies: CompanyWrite[]): Promise<WriteResult> {
    const writes: WriteItem[] = [];
    const result = emptyResult();
    for (const company of companies) {
      try {
        const existing = await this.findCompanyRecord(company);
        writes.push({identity: company.companyId, fields: toAirtableCompanyFields(company), recordId: existing?.id});
      } catch (error) {
        result.failed += 1;
        result.results.push({identity: company.companyId, error: errorMessage(error)});
      }
    }
    return this.performWrites(AIRTABLE_TABLES.companies, writes, result);
  }

  async replaceKeywords(companyId: string, keywords: CuratedKeyword[]): Promise<WriteResult> {
    const result = emptyResult();
    let existing: AirtableRecord[];
    try {
      existing = await this.client.list(AIRTABLE_TABLES.keywords, {filterByFormula: equalityFormula('Identity • Company ID', companyId)});
    } catch (error) {
      return {succeeded: 0, failed: keywords.length, results: keywords.map((keyword) => ({identity: keyword.calculated.keywordId, error: errorMessage(error)}))};
    }
    const existingByIdentity = new Map(existing.map((record) => [String(record.fields['Identity • Keyword ID'] ?? ''), record]));
    const writes = keywords.map((keyword) => ({identity: keyword.calculated.keywordId, fields: toAirtableKeywordFields(keyword), recordId: existingByIdentity.get(keyword.calculated.keywordId)?.id}));
    const written = await this.performWrites(AIRTABLE_TABLES.keywords, writes, result);
    if (written.failed > 0) return written;

    const incoming = new Set(keywords.map((keyword) => keyword.calculated.keywordId));
    const obsolete = existing.filter((record) => !incoming.has(String(record.fields['Identity • Keyword ID'] ?? ''))).map((record) => record.id);
    for (const batch of chunks(obsolete)) {
      try {
        await this.client.delete(AIRTABLE_TABLES.keywords, batch);
      } catch (error) {
        written.failed += batch.length;
        written.results.push(...batch.map((identity) => ({identity, error: errorMessage(error)})));
      }
    }
    return written;
  }

  async upsertPaidAds(paidAds: CuratedPaidAd[]): Promise<WriteResult> {
    const result = emptyResult();
    const writes: WriteItem[] = [];
    for (const ad of paidAds) {
      try {
        const existing = await this.client.list(AIRTABLE_TABLES.paidAds, {filterByFormula: equalityFormula('Identity • Paid Ad ID', ad.calculated.paidAdId)});
        writes.push({identity: ad.calculated.paidAdId, fields: toAirtablePaidAdFields(ad), recordId: existing[0]?.id});
      } catch (error) {
        result.failed += 1;
        result.results.push({identity: ad.calculated.paidAdId, error: errorMessage(error)});
      }
    }
    return this.performWrites(AIRTABLE_TABLES.paidAds, writes, result);
  }

  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    const [companies, keywords, paidAds, publishedInsights] = await Promise.all([
      this.client.list(AIRTABLE_TABLES.companies), this.client.list(AIRTABLE_TABLES.keywords), this.client.list(AIRTABLE_TABLES.paidAds), this.client.list(AIRTABLE_TABLES.insights),
    ]);
    return {companies, keywords, paidAds, publishedInsights};
  }

  async getDueInsightInputs(): Promise<DueInsightInput[]> {
    const [companies, insights, reviews] = await Promise.all([this.client.list(AIRTABLE_TABLES.companies), this.client.list(AIRTABLE_TABLES.insights), this.client.list(AIRTABLE_TABLES.reviews)]);
    const byCompany = (records: AirtableRecord[]) => new Map(records.map((record) => [String(record.fields['Identity • Company ID'] ?? ''), record]));
    const published = byCompany(insights);
    const review = byCompany(reviews);
    const now = Date.now();
    return companies.flatMap((company) => {
      const companyId = firstCompanyId(company);
      if (!companyId) return [];
      const insight = published.get(companyId);
      const dueAt = company.fields['Workflow • Next Insight Due At'];
      const changed = insight?.fields['Workflow • Evidence Fingerprint'] !== company.fields['Workflow • Evidence Fingerprint'];
      const due = typeof dueAt === 'string' && Date.parse(dueAt) <= now;
      return !insight || changed || due ? [{company, publishedInsight: insight, review: review.get(companyId)}] : [];
    });
  }

  async upsertReview(review: ReviewWireInput): Promise<WriteResult> {
    return this.upsertOne(AIRTABLE_TABLES.reviews, 'Identity • Company ID', review.companyId, toAirtableReviewFields(review));
  }

  async upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult> {
    return this.upsertOne(AIRTABLE_TABLES.insights, 'Identity • Insight ID', insight.insightId, toAirtableInsightFields(insight));
  }

  async updateSystem(system: SystemWireInput): Promise<WriteResult> {
    return this.upsertOne(AIRTABLE_TABLES.system, 'Identity • System ID', system.systemId, toAirtableSystemFields(system));
  }

  private async findCompanyRecord(company: CompanyWrite): Promise<AirtableRecord | undefined> {
    if (company.identity.apolloAccountId) {
      const byAccount = await this.client.list(AIRTABLE_TABLES.companies, {filterByFormula: equalityFormula('Observed • Apollo Account ID', company.identity.apolloAccountId)});
      if (byAccount[0]) return byAccount[0];
    }
    const byDomain = await this.client.list(AIRTABLE_TABLES.companies, {filterByFormula: equalityFormula('Identity • Canonical Domain', company.identity.canonicalDomain)});
    return byDomain[0];
  }

  private async upsertOne(table: AirtableTable, field: string, identity: string, fields: AirtableFields): Promise<WriteResult> {
    try {
      const existing = await this.client.list(table, {filterByFormula: equalityFormula(field, identity)});
      return this.performWrites(table, [{identity, fields, recordId: existing[0]?.id}], emptyResult());
    } catch (error) {
      return {succeeded: 0, failed: 1, results: [{identity, error: errorMessage(error)}]};
    }
  }

  private async performWrites(table: AirtableTable, writes: WriteItem[], initial: WriteResult): Promise<WriteResult> {
    const result = initial;
    const creates = writes.filter((write) => !write.recordId);
    const updates = writes.filter((write) => write.recordId);
    for (const [records, isUpdate] of [[creates, false], [updates, true]] as const) {
      for (const batch of chunks(records)) {
        if (!batch.length) continue;
        try {
          const written = isUpdate
            ? await this.client.update(table, batch.map(({recordId, fields}) => ({id: recordId, fields})))
            : await this.client.create(table, batch.map(({fields}) => ({fields})));
          result.succeeded += batch.length;
          result.results.push(...batch.map((item, index) => ({identity: item.identity, recordId: written[index]?.id})));
        } catch (error) {
          result.failed += batch.length;
          result.results.push(...batch.map((item): RecordResult => ({identity: item.identity, error: errorMessage(error)})));
        }
      }
    }
    return result;
  }
}
