import type {CuratedKeyword, CuratedPaidAd} from '@/lib/domain/metrics';
import {AirtableClient, AirtableClientError} from './client';
import {toAirtableCompanyFields, toAirtableInsightFields, toAirtableKeywordFields, toAirtablePaidAdFields, toAirtableReviewFields, toAirtableSystemFields} from './mappers';
import {AIRTABLE_TABLES, type AirtableFields, type AirtableRecord, type AirtableTable, type AirtableTableMap, type CompanyPersistenceWrite, type CompetitorStore, type DashboardSnapshot, type DueInsightInput, type InsightWireInput, type RecordResult, type ReviewWireInput, type SystemWireInput, type WriteResult} from './types';

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

function replacementFailure(companyId: string, error: string): WriteResult {
  return {succeeded: 0, failed: 1, results: [{identity: companyId, error}]};
}

function firstCompanyId(record: AirtableRecord): string | null {
  const value = record.fields['Identity • Company ID'];
  return typeof value === 'string' && value ? value : null;
}

type WriteItem = {identity: string; fields: AirtableFields; recordId?: string};

/** Server-only Airtable adapter. Its public methods expose curated domain inputs and typed wire records only. */
export class AirtableCompetitorRepository implements CompetitorStore {
  private readonly tables: AirtableTableMap;
  constructor(private readonly client: AirtableClient, tables: AirtableTableMap = AIRTABLE_TABLES) { this.tables = tables; }

  async resolveCompanyIdentity(identity: {apolloAccountId: string; canonicalDomain: string}): Promise<{companyId: string; source: 'apollo_account_id' | 'canonical_domain'} | null> {
    if (identity.apolloAccountId) {
      const byAccount = await this.client.list(this.tables.companies, {filterByFormula: equalityFormula('Observed • Apollo Account ID', identity.apolloAccountId)});
      const companyId = byAccount.map(firstCompanyId).find((value): value is string => value !== null);
      if (companyId) return {companyId, source: 'apollo_account_id'};
    }
    if (identity.canonicalDomain) {
      const byDomain = await this.client.list(this.tables.companies, {filterByFormula: equalityFormula('Identity • Canonical Domain', identity.canonicalDomain)});
      const companyId = byDomain.map(firstCompanyId).find((value): value is string => value !== null);
      if (companyId) return {companyId, source: 'canonical_domain'};
    }
    return null;
  }

  async upsertCompanies(companies: CompanyPersistenceWrite[]): Promise<WriteResult> {
    const writes: WriteItem[] = [];
    const result = emptyResult();
    for (const company of companies) {
      try {
        const existing = await this.findCompanyRecord(company);
        if (existing && firstCompanyId(existing) !== company.companyId) {
          result.failed += 1;
          result.results.push({identity: company.companyId, error: 'identity_conflict'});
          continue;
        }
        writes.push({identity: company.companyId, fields: toAirtableCompanyFields(company), recordId: existing?.id});
      } catch (error) {
        result.failed += 1;
        result.results.push({identity: company.companyId, error: errorMessage(error)});
      }
    }
    return this.performWrites(this.tables.companies, writes, result);
  }

  async replaceKeywords(companyId: string, keywords: CuratedKeyword[]): Promise<WriteResult> {
    const result = emptyResult();
    let existing: AirtableRecord[];
    let companyRecord: AirtableRecord | undefined;
    try {
      companyRecord = await this.findCompanyRecordById(companyId);
      if (!companyRecord) return {succeeded: 0, failed: keywords.length, results: keywords.map((keyword) => ({identity: keyword.calculated.keywordId, error: 'company_link_missing'}))};
      existing = await this.client.list(this.tables.keywords, {filterByFormula: equalityFormula('Identity • Company ID', companyId)});
    } catch (error) {
      return {succeeded: 0, failed: keywords.length, results: keywords.map((keyword) => ({identity: keyword.calculated.keywordId, error: errorMessage(error)}))};
    }
    const existingByIdentity = new Map<string, AirtableRecord>();
    const duplicateRecordIds: string[] = [];
    for (const record of existing) {
      const identity = String(record.fields['Identity • Keyword ID'] ?? '');
      if (existingByIdentity.has(identity)) duplicateRecordIds.push(record.id);
      else existingByIdentity.set(identity, record);
    }
    const writes = keywords.map((keyword) => ({identity: keyword.calculated.keywordId, fields: toAirtableKeywordFields(keyword, companyRecord.id), recordId: existingByIdentity.get(keyword.calculated.keywordId)?.id}));
    const written = await this.performWrites(this.tables.keywords, writes, result);
    if (written.failed > 0) return written;

    const incoming = new Set(keywords.map((keyword) => keyword.calculated.keywordId));
    const obsolete = [...new Set([
      ...existing.filter((record) => !incoming.has(String(record.fields['Identity • Keyword ID'] ?? ''))).map((record) => record.id),
      ...duplicateRecordIds,
    ])];
    for (const batch of chunks(obsolete)) {
      try {
        await this.client.delete(this.tables.keywords, batch);
      } catch (error) {
        written.failed += batch.length;
        written.results.push(...batch.map((identity) => ({identity, error: errorMessage(error)})));
      }
    }
    return written;
  }

  async replacePaidAds(companyId: string, ads: CuratedPaidAd[]): Promise<WriteResult> {
    let company: AirtableRecord;
    let existing: AirtableRecord[];
    let writes: WriteItem[];
    try {
      const companies = await this.client.list(this.tables.companies, {filterByFormula: equalityFormula('Identity • Company ID', companyId)});
      if (!companies.length) return replacementFailure(companyId, 'company_link_missing');
      if (companies.length !== 1) return replacementFailure(companyId, 'duplicate_company_records');
      company = companies[0];

      const incomingIds = new Set<string>();
      for (const ad of ads) {
        if (ad.calculated.companyId !== companyId) return replacementFailure(companyId, 'paid_ad_company_mismatch');
        if (!ad.calculated.paidAdId || incomingIds.has(ad.calculated.paidAdId)) return replacementFailure(companyId, 'duplicate_incoming_paid_ad_identity');
        incomingIds.add(ad.calculated.paidAdId);
      }

      existing = await this.client.list(this.tables.paidAds, {filterByFormula: equalityFormula('Identity • Company ID', companyId)});
      const existingByIdentity = new Map<string, AirtableRecord>();
      for (const record of existing) {
        const identity = record.fields['Identity • Paid Ad ID'];
        const link = record.fields['Identity • Company Link'];
        if (firstCompanyId(record) !== companyId || !Array.isArray(link) || link.length !== 1 || link[0] !== company.id) return replacementFailure(companyId, 'paid_ad_company_link_mismatch');
        if (typeof identity !== 'string' || !identity || existingByIdentity.has(identity)) return replacementFailure(companyId, 'duplicate_existing_paid_ad_identity');
        existingByIdentity.set(identity, record);
      }

      // Construct every mapped record before the first write. Invalid timestamps
      // or mapper inputs therefore leave the previous snapshot intact.
      writes = ads.map((ad) => {
        const stored = existingByIdentity.get(ad.calculated.paidAdId);
        const first = stored?.fields['Observed • First Observed At'];
        const last = stored?.fields['Observed • Last Observed At'];
        return {identity: ad.calculated.paidAdId, recordId: stored?.id, fields: toAirtablePaidAdFields(ad, company.id, typeof first === 'string' ? first : undefined, typeof last === 'string' ? last : undefined)};
      });
    } catch (error) {
      return replacementFailure(companyId, errorMessage(error));
    }

    const written = await this.performWrites(this.tables.paidAds, writes, emptyResult());
    if (written.failed) return written;

    const incomingIds = new Set(ads.map((ad) => ad.calculated.paidAdId));
    const obsolete = existing.filter((record) => !incomingIds.has(String(record.fields['Identity • Paid Ad ID']))).map((record) => record.id);
    for (const batch of chunks(obsolete)) {
      try {
        await this.client.delete(this.tables.paidAds, batch);
      } catch (error) {
        written.failed += batch.length;
        written.results.push(...batch.map((recordId) => ({identity: recordId, error: errorMessage(error)})));
      }
    }
    return written;
  }

  async upsertPaidAds(paidAds: CuratedPaidAd[]): Promise<WriteResult> {
    const result = emptyResult();
    const writes: WriteItem[] = [];
    const byCompany = new Map<string, CuratedPaidAd[]>();
    for (const ad of paidAds) {
      const group = byCompany.get(ad.calculated.companyId) ?? [];
      group.push(ad);
      byCompany.set(ad.calculated.companyId, group);
    }
    for (const [companyId, ads] of byCompany) {
      try {
        const companyRecord = await this.findCompanyRecordById(companyId);
        if (!companyRecord) {
          result.failed += ads.length;
          result.results.push(...ads.map((ad) => ({identity: ad.calculated.paidAdId, error: 'company_link_missing'})));
          continue;
        }
        const groupWrites: WriteItem[] = [];
        for (const ad of ads) {
          const existing = await this.client.list(this.tables.paidAds, {filterByFormula: equalityFormula('Identity • Paid Ad ID', ad.calculated.paidAdId)});
          const firstObservedAt = existing[0]?.fields['Observed • First Observed At'];
          const lastObservedAt = existing[0]?.fields['Observed • Last Observed At'];
          groupWrites.push({identity: ad.calculated.paidAdId, fields: toAirtablePaidAdFields(ad, companyRecord.id, typeof firstObservedAt === 'string' ? firstObservedAt : undefined, typeof lastObservedAt === 'string' ? lastObservedAt : undefined), recordId: existing[0]?.id});
        }
        writes.push(...groupWrites);
      } catch (error) {
        result.failed += ads.length;
        result.results.push(...ads.map((ad) => ({identity: ad.calculated.paidAdId, error: errorMessage(error)})));
      }
    }
    return this.performWrites(this.tables.paidAds, writes, result);
  }

  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    const [companies, keywords, paidAds, publishedInsights, reviews, system] = await Promise.all([
      this.client.list(this.tables.companies), this.client.list(this.tables.keywords), this.client.list(this.tables.paidAds), this.client.list(this.tables.insights), this.client.list(this.tables.reviews), this.client.list(this.tables.system),
    ]);
    return {companies, keywords, paidAds, publishedInsights, reviews, system};
  }

  async getDueInsightInputs(): Promise<DueInsightInput[]> {
    const [companies, insights, reviews] = await Promise.all([this.client.list(this.tables.companies), this.client.list(this.tables.insights), this.client.list(this.tables.reviews)]);
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
    try {
      const existing = await this.client.list(this.tables.reviews, {filterByFormula: equalityFormula('Identity • Company ID', review.companyId)});
      if (existing.length > 1) return {succeeded: 0, failed: 1, results: [{identity: review.companyId, error: 'duplicate_review_records'}]};
      return this.upsertCompanyLinked(this.tables.reviews, 'Identity • Company ID', review.companyId, (companyRecordId) => toAirtableReviewFields(review, companyRecordId));
    } catch (error) {
      return {succeeded: 0, failed: 1, results: [{identity: review.companyId, error: errorMessage(error)}]};
    }
  }

  async upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult> {
    try {
      const company = await this.findCompanyRecordById(insight.companyId);
      if (!company) return {succeeded: 0, failed: 1, results: [{identity: insight.companyId, error: 'company_link_missing'}]};
      const existing = await this.client.list(this.tables.insights, {filterByFormula: equalityFormula('Identity • Company ID', insight.companyId)});
      if (existing.length > 1) return {succeeded: 0, failed: 1, results: [{identity: insight.companyId, error: 'duplicate_published_insights'}]};
      // Company identity, not generated insight identity, enforces one current
      // published row. The write cannot target another company's record.
      return this.performWrites(this.tables.insights, [{identity: insight.companyId, fields: toAirtableInsightFields(insight, company.id), recordId: existing[0]?.id}], emptyResult());
    } catch (error) {
      return {succeeded: 0, failed: 1, results: [{identity: insight.companyId, error: errorMessage(error)}]};
    }
  }

  async updateSystem(system: SystemWireInput): Promise<WriteResult> {
    return this.upsertOne(this.tables.system, 'Identity • System ID', system.systemId, toAirtableSystemFields(system));
  }

  private async findCompanyRecord(company: CompanyPersistenceWrite): Promise<AirtableRecord | undefined> {
    if (company.identity.apolloAccountId) {
      const byAccount = await this.client.list(this.tables.companies, {filterByFormula: equalityFormula('Observed • Apollo Account ID', company.identity.apolloAccountId)});
      if (byAccount[0]) return byAccount[0];
    }
    const byDomain = await this.client.list(this.tables.companies, {filterByFormula: equalityFormula('Identity • Canonical Domain', company.identity.canonicalDomain)});
    if (byDomain[0]) return byDomain[0];
    return this.findCompanyRecordById(company.companyId);
  }

  private async findCompanyRecordById(companyId: string): Promise<AirtableRecord | undefined> {
    const records = await this.client.list(this.tables.companies, {filterByFormula: equalityFormula('Identity • Company ID', companyId)});
    return records[0];
  }

  private async upsertOne(table: AirtableTable, field: string, identity: string, fields: AirtableFields): Promise<WriteResult> {
    try {
      const existing = await this.client.list(table, {filterByFormula: equalityFormula(field, identity)});
      return this.performWrites(table, [{identity, fields, recordId: existing[0]?.id}], emptyResult());
    } catch (error) {
      return {succeeded: 0, failed: 1, results: [{identity, error: errorMessage(error)}]};
    }
  }

  private async upsertCompanyLinked(table: AirtableTable, field: string, identity: string, fieldsForCompany: (companyRecordId: string) => AirtableFields, companyId = identity): Promise<WriteResult> {
    try {
      const company = await this.findCompanyRecordById(companyId);
      if (!company) return {succeeded: 0, failed: 1, results: [{identity, error: 'company_link_missing'}]};
      return this.upsertOne(table, field, identity, fieldsForCompany(company.id));
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
