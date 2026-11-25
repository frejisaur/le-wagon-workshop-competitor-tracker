import {readFileSync} from 'node:fs';
import {parseCompanyRecord, presentFields, stageCompanyEvidence, toBattlecardFields, toCompanyFields, toReviewFields} from './company-row';
import {parseDashboardSnapshot, type StoredTables} from './snapshot';
import {toAirtableSystemFields} from './system-row';
import type {AirtableFields, AirtableRecord, CompanyPersistenceWrite, CompanyWrite, CompetitorStore, DashboardSnapshot, EvidenceFingerprinter, InsightWireInput, ReviewWireInput, SystemWireInput, WriteResult} from './types';

export type FixtureSnapshot = Partial<StoredTables>;
type FixtureTable = keyof StoredTables;
const FIXTURE_TABLES: FixtureTable[] = ['companies', 'system'];

function recordId(table: FixtureTable, identity: string): string {
  return `fixture-${table}-${encodeURIComponent(identity)}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function failure(identity: string, error: string): WriteResult {
  return {succeeded: 0, failed: 1, results: [{identity, error}]};
}

/** In-memory fixture implementation. The source JSON is read once and is never written or mutated. */
export class FixtureCompetitorRepository implements CompetitorStore {
  private readonly tables = new Map<FixtureTable, Map<string, AirtableRecord>>();

  private constructor(snapshot: FixtureSnapshot) {
    const unsupported = Object.keys(snapshot).filter((key) => !FIXTURE_TABLES.includes(key as FixtureTable));
    if (unsupported.length) throw new TypeError(`Fixture snapshot has unsupported tables: ${unsupported.sort().join(', ')}`);
    for (const key of FIXTURE_TABLES) {
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

  async upsertCompanies(companies: CompanyPersistenceWrite[]): Promise<WriteResult> {
    const results: WriteResult['results'] = [];
    for (const company of companies) {
      const existing = this.findCompanyRecord(company);
      if (existing && existing.fields['Identity • Company ID'] !== company.companyId) {
        results.push({identity: company.companyId, error: 'identity_conflict'});
        continue;
      }
      try {
        results.push({identity: company.companyId, recordId: this.patch('companies', existing?.id ?? recordId('companies', company.companyId), toCompanyFields(company, existing && parseCompanyRecord(existing)))});
      } catch {
        // Keep fixture failure semantics aligned with the production adapter, which does not expose mapper internals.
        results.push({identity: company.companyId, error: 'Airtable request failed'});
      }
    }
    return {succeeded: results.filter((item) => !item.error).length, failed: results.filter((item) => item.error).length, results};
  }

  async writeCompanyEvidence(company: CompanyWrite, fingerprint: EvidenceFingerprinter): Promise<WriteResult> {
    const record = this.findSingleCompanyRecord(company.companyId);
    if (typeof record === 'string') return failure(company.companyId, record);
    let fields: AirtableFields;
    try {
      fields = stageCompanyEvidence(record, company, fingerprint);
    } catch {
      return failure(company.companyId, 'Airtable request failed');
    }
    return {succeeded: 1, failed: 0, results: [{identity: company.companyId, recordId: this.patch('companies', record.id, fields)}]};
  }

  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    return parseDashboardSnapshot(this.toSnapshot());
  }

  /** Sanitized fixture state for explicit CLI write-back; source fixture files are never mutated implicitly. */
  toSnapshot(): StoredTables {
    return {companies: this.records('companies'), system: this.records('system')};
  }

  async upsertReview(review: ReviewWireInput): Promise<WriteResult> {
    return this.patchCompany(review.companyId, () => toReviewFields(review));
  }

  /** Exactly one current published battlecard per company: the insight ID is provenance, never the lookup key. */
  async upsertPublishedInsight(insight: InsightWireInput): Promise<WriteResult> {
    return this.patchCompany(insight.companyId, () => toBattlecardFields(insight));
  }

  async updateSystem(system: SystemWireInput): Promise<WriteResult> {
    const existing = this.records('system').find((record) => record.fields['Identity • System ID'] === system.systemId);
    return {succeeded: 1, failed: 0, results: [{identity: system.systemId, recordId: this.patch('system', existing?.id ?? recordId('system', system.systemId), toAirtableSystemFields(system))}]};
  }

  /** Test-only inspection helper; it exposes only stored curated identities. */
  companyIds(): string[] {
    return this.records('companies')
      .map((record) => record.fields['Identity • Company ID'])
      .filter((companyId): companyId is string => typeof companyId === 'string')
      .sort();
  }

  private patchCompany(companyId: string, fieldsFor: () => AirtableFields): WriteResult {
    const record = this.findSingleCompanyRecord(companyId);
    if (typeof record === 'string') return failure(companyId, record);
    try {
      return {succeeded: 1, failed: 0, results: [{identity: companyId, recordId: this.patch('companies', record.id, fieldsFor())}]};
    } catch {
      return failure(companyId, 'Airtable request failed');
    }
  }

  /** Airtable PATCH parity: omitted fields stay untouched and explicit nulls clear. */
  private patch(table: FixtureTable, id: string, fields: AirtableFields): string {
    const previous = this.table(table).get(id);
    this.table(table).set(id, {id, fields: clone({...previous?.fields, ...presentFields(fields)})});
    return id;
  }

  private findCompanyRecord(company: CompanyPersistenceWrite): AirtableRecord | undefined {
    const companies = this.records('companies');
    if (company.identity.apolloAccountId) {
      const byAccount = companies.find((record) => record.fields['Observed • Apollo Account ID'] === company.identity.apolloAccountId);
      if (byAccount) return byAccount;
    }
    return companies.find((record) => record.fields['Identity • Canonical Domain'] === company.identity.canonicalDomain)
      ?? companies.find((record) => record.fields['Identity • Company ID'] === company.companyId);
  }

  private findSingleCompanyRecord(companyId: string): AirtableRecord | 'company_missing' | 'duplicate_company_records' {
    const records = this.records('companies').filter((record) => record.fields['Identity • Company ID'] === companyId);
    if (records.length > 1) return 'duplicate_company_records';
    return records[0] ?? 'company_missing';
  }

  private table(key: FixtureTable): Map<string, AirtableRecord> {
    const table = this.tables.get(key);
    if (!table) throw new TypeError(`Missing fixture table ${key}`);
    return table;
  }

  private records(key: FixtureTable): AirtableRecord[] {
    return [...this.table(key).values()].map(clone);
  }
}
