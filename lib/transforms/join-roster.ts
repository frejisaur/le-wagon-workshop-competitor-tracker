import type {ObservedGroup} from '@/lib/domain/classification';
import type {CompanyIdentityResolution} from '@/lib/domain/company';
import type {ApolloRow} from '@/lib/schemas/apollo';
import type {SemrushDomainOverview} from '@/lib/schemas/semrush';
import {normalizeDomain} from './normalize';

/** A batch label, not a provider-derived timestamp, for the initial static import. */
export const INITIAL_APIFY_OBSERVATION_BATCH = 'initial-import';

export type JoinRejectionCode =
  | 'missing_apollo_website'
  | 'invalid_apollo_website'
  | 'duplicate_apollo_domain'
  | 'conflicting_apollo_source_identity'
  | 'invalid_semrush_domain'
  | 'conflicting_semrush_observation'
  | 'apify_only';

export type JoinRejection = {
  code: JoinRejectionCode;
  message: string;
  canonicalDomain?: string;
  provider: 'apollo' | 'semrush';
  index: number;
};

export type JoinedRosterCompany = {
  canonicalDomain: string;
  identity: CompanyIdentityResolution;
  apollo: ObservedGroup<ApolloRow>;
  semrush: ObservedGroup<{records: SemrushDomainOverview[]}>;
};

export type JoinReport = {
  accepted: JoinedRosterCompany[];
  rejections: JoinRejection[];
  unmatchedApollo: JoinedRosterCompany[];
  apifyOnly: Array<{canonicalDomain: string; record: SemrushDomainOverview}>;
};

export type JoinContext = {
  /** The one observation-batch label for this join call; initial import uses its batch label. */
  observedAt?: string;
  rawRef?: string;
};

type SemrushObservation = {canonicalDomain: string; record: SemrushDomainOverview; index: number};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function indexesByValue(rows: ApolloRow[], key: 'Apollo Account Id' | 'Apollo Record Id', valid: Set<number>): Map<string, number[]> {
  const result = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (!valid.has(index) || !row[key].trim()) return;
    const matches = result.get(row[key]) ?? [];
    matches.push(index);
    result.set(row[key], matches);
  });
  return result;
}

/**
 * Left-joins validated Apollo roster records to validated Semrush observations.
 * It never constructs a company ID: repositories resolve the supplied identity
 * inputs against persisted state before assigning an immutable ID.
 */
export function joinRoster(
  apolloRows: ApolloRow[],
  semrushRecords: SemrushDomainOverview[],
  context: JoinContext = {},
): JoinReport {
  const observedAt = context.observedAt ?? INITIAL_APIFY_OBSERVATION_BATCH;
  const rejections: JoinRejection[] = [];
  const validApollo = new Set<number>();
  const domains = new Map<number, string>();

  apolloRows.forEach((row, index) => {
    if (!row.Website.trim()) {
      rejections.push({code: 'missing_apollo_website', message: 'Apollo Website is required', provider: 'apollo', index});
      return;
    }
    const domain = normalizeDomain(row.Website);
    if (!domain) {
      rejections.push({code: 'invalid_apollo_website', message: 'Apollo Website is not a public hostname', provider: 'apollo', index});
      return;
    }
    validApollo.add(index);
    domains.set(index, domain);
  });

  const invalidApollo = new Set<number>();
  const markConflicts = (groups: Map<string, number[]>, code: Extract<JoinRejectionCode, 'duplicate_apollo_domain' | 'conflicting_apollo_source_identity'>) => {
    groups.forEach((indexes, key) => {
      if (indexes.length < 2) return;
      indexes.forEach((index) => {
        invalidApollo.add(index);
        rejections.push({code, message: `Apollo identity conflict for ${key}`, canonicalDomain: domains.get(index), provider: 'apollo', index});
      });
    });
  };
  const domainGroups = new Map<string, number[]>();
  domains.forEach((domain, index) => {
    const indexes = domainGroups.get(domain) ?? [];
    indexes.push(index);
    domainGroups.set(domain, indexes);
  });
  markConflicts(domainGroups, 'duplicate_apollo_domain');
  markConflicts(indexesByValue(apolloRows, 'Apollo Account Id', validApollo), 'conflicting_apollo_source_identity');
  markConflicts(indexesByValue(apolloRows, 'Apollo Record Id', validApollo), 'conflicting_apollo_source_identity');

  const candidates = [...validApollo].filter((index) => !invalidApollo.has(index));
  const bySemrushKey = new Map<string, SemrushObservation[]>();
  semrushRecords.forEach((record, index) => {
    const canonicalDomain = normalizeDomain(record.domain);
    if (!canonicalDomain) {
      rejections.push({code: 'invalid_semrush_domain', message: 'Semrush domain is not a public hostname', provider: 'semrush', index});
      return;
    }
    const key = `${canonicalDomain}\u0000${record.database}\u0000${observedAt}`;
    const entries = bySemrushKey.get(key) ?? [];
    entries.push({canonicalDomain, record, index});
    bySemrushKey.set(key, entries);
  });

  const semrushByDomain = new Map<string, SemrushDomainOverview[]>();
  bySemrushKey.forEach((entries) => {
    const first = entries[0];
    if (entries.some((entry) => canonicalJson(entry.record) !== canonicalJson(first.record))) {
      entries.forEach((entry) => rejections.push({
        code: 'conflicting_semrush_observation',
        message: 'Conflicting Semrush observations share domain, database, and observation batch',
        canonicalDomain: entry.canonicalDomain,
        provider: 'semrush',
        index: entry.index,
      }));
      return;
    }
    const records = semrushByDomain.get(first.canonicalDomain) ?? [];
    records.push(first.record);
    semrushByDomain.set(first.canonicalDomain, records);
  });

  const accepted = candidates.map((index): JoinedRosterCompany => {
    const row = apolloRows[index];
    const canonicalDomain = domains.get(index)!;
    const semrushRecordsForDomain = semrushByDomain.get(canonicalDomain) ?? [];
    return {
      canonicalDomain,
      identity: {canonicalDomain, apolloAccountId: row['Apollo Account Id'], apolloRecordId: row['Apollo Record Id']},
      apollo: {...row, classification: 'observed', source: 'apollo', observedAt},
      semrush: {
        records: semrushRecordsForDomain,
        classification: 'observed',
        source: 'semrush',
        observedAt,
        rawRef: context.rawRef,
      },
    };
  });
  const unmatchedApollo = accepted.filter((company) => company.semrush.records.length === 0);
  const rosterDomains = new Set(candidates.map((index) => domains.get(index)!));
  const apifyOnly: JoinReport['apifyOnly'] = [];
  semrushByDomain.forEach((records, canonicalDomain) => {
    if (rosterDomains.has(canonicalDomain)) return;
    records.forEach((record) => {
      apifyOnly.push({canonicalDomain, record});
      rejections.push({code: 'apify_only', message: 'Semrush domain is absent from the Apollo roster', canonicalDomain, provider: 'semrush', index: semrushRecords.indexOf(record)});
    });
  });
  return {accepted, rejections, unmatchedApollo, apifyOnly};
}
