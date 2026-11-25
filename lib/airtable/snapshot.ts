import {parseCompanyRecord} from './company-row';
import {selectSystemRecord} from './system-row';
import type {AirtableRecord, DashboardSnapshot} from './types';

/** The two serving tables as stored, before parsing. */
export type StoredTables = {companies: AirtableRecord[]; system: AirtableRecord[]};

export function parseDashboardSnapshot(tables: StoredTables): DashboardSnapshot {
  return {companies: tables.companies.map(parseCompanyRecord), system: selectSystemRecord(tables.system)};
}
