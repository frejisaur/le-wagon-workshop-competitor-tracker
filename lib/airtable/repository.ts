import {AirtableClient, AirtableClientError} from './client';
import {parseCompanyRecord, stageCompanyEvidence, toBattlecardFields, toCompanyFields, toReviewFields} from './company-row';
import {parseDashboardSnapshot} from './snapshot';
import {toAirtableSystemFields} from './system-row';
import {AIRTABLE_TABLES, type AirtableFields, type AirtableRecord, type AirtableTable, type CompanyPersistenceWrite, type CompanyWrite, type CompetitorStore, type DashboardSnapshot, type EvidenceFingerprinter, type InsightWireInput, type RecordResult, type ReviewWireInput, type SystemWireInput, type WriteResult} from './types';

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

function failure(identity: string, error: string): WriteResult {
  return {succeeded: 0, failed: 1, results: [{identity, error}]};
}

function firstCompanyId(record: AirtableRecord): string | null {
  const value = record.fields['Identity • Company ID'];
  return typeof value === 'string' && value ? value : null;
}

type WriteItem = {identity: string; fields: AirtableFields; recordId?: string};

/** Server-only Airtable adapter. Its public methods expose curated domain inputs and parsed rows only. */
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
        writes.push({identity: company.companyId, fields: toCompanyFields(company, existing && parseCompanyRecord(existing)), recordId: existing?.id});
      } catch (error) {
        result.failed += 1;
        result.results.push({identity: company.companyId, error: errorMessage(error)});
      }
    }
    return this.performWrites(AIRTABLE_TABLES.companies, writes, result);
  }

  async writeCompanyEvidence(company: CompanyWrite, fingerprint: EvidenceFingerprinter): Promise<WriteResult> {
    let fields: AirtableFields;
    let recordId: string;
    try {
      const record = await this.findSingleCompanyRecord(company.companyId);
      if (typeof record === 'string') return failure(company.companyId, record);
      // Stage the complete PATCH before writing: a mapping failure leaves the stored row untouched.
      fields = stageCompanyEvidence(record, company, fingerprint);
      recordId = record.id;
    } catch (error) {
      return failure(company.companyId, errorMessage(error));
    }
    return this.performWrites(AIRTABLE_TABLES.companies, [{identity: company.companyId, fields, recordId}], emptyResult());
  }

  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    const [companies, system] = await Promise.all([this.client.list(AIRTABLE_TABLES.companies), this.client.list(AIRTABLE_TABLES.system)]);
    return parseDashboardSnapshot({companies, system});
  }

  async upsertReview(review: ReviewWireInput): Promise<WriteResult> {
    return this.patchCompany(review.companyId, () => toReviewFields(review));
  }

  /** Company identity, not generated insight identity, keeps exactly one current published battlecard. */
  async upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult> {
    return this.patchCompany(insight.companyId, () => toBattlecardFields(insight));
  }

  async updateSystem(system: SystemWireInput): Promise<WriteResult> {
    try {
      const existing = await this.client.list(AIRTABLE_TABLES.system, {filterByFormula: equalityFormula('Identity • System ID', system.systemId)});
      return this.performWrites(AIRTABLE_TABLES.system, [{identity: system.systemId, fields: toAirtableSystemFields(system), recordId: existing[0]?.id}], emptyResult());
    } catch (error) {
      return failure(system.systemId, errorMessage(error));
    }
  }

  private async patchCompany(companyId: string, fieldsFor: () => AirtableFields): Promise<WriteResult> {
    try {
      const record = await this.findSingleCompanyRecord(companyId);
      if (typeof record === 'string') return failure(companyId, record);
      return this.performWrites(AIRTABLE_TABLES.companies, [{identity: companyId, fields: fieldsFor(), recordId: record.id}], emptyResult());
    } catch (error) {
      return failure(companyId, errorMessage(error));
    }
  }

  private async findCompanyRecord(company: CompanyPersistenceWrite): Promise<AirtableRecord | undefined> {
    if (company.identity.apolloAccountId) {
      const byAccount = await this.client.list(AIRTABLE_TABLES.companies, {filterByFormula: equalityFormula('Observed • Apollo Account ID', company.identity.apolloAccountId)});
      if (byAccount[0]) return byAccount[0];
    }
    const byDomain = await this.client.list(AIRTABLE_TABLES.companies, {filterByFormula: equalityFormula('Identity • Canonical Domain', company.identity.canonicalDomain)});
    if (byDomain[0]) return byDomain[0];
    return (await this.client.list(AIRTABLE_TABLES.companies, {filterByFormula: equalityFormula('Identity • Company ID', company.companyId)}))[0];
  }

  /** The one row for a company ID, or the reason no write may target it. */
  private async findSingleCompanyRecord(companyId: string): Promise<AirtableRecord | 'company_missing' | 'duplicate_company_records'> {
    const records = await this.client.list(AIRTABLE_TABLES.companies, {filterByFormula: equalityFormula('Identity • Company ID', companyId)});
    if (records.length > 1) return 'duplicate_company_records';
    return records[0] ?? 'company_missing';
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
